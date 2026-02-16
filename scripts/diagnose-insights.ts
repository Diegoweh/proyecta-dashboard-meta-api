import prisma from '../lib/prisma';

// Read .env file manually
import { readFileSync } from 'fs';
import { join } from 'path';

const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    acc[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return acc;
}, {} as Record<string, string>);

async function diagnoseInsights() {
  try {
    // Fetch sample insights from Meta API to see what ad_ids they have
    const META_ACCESS_TOKEN = envVars.META_ACCESS_TOKEN;
    const META_AD_ACCOUNT_ID = envVars.META_AD_ACCOUNT_ID;

    if (!META_ACCESS_TOKEN) {
      console.error('❌ Missing META_ACCESS_TOKEN in .env file');
      process.exit(1);
    }

    if (!META_AD_ACCOUNT_ID) {
      console.log('ℹ️  No META_AD_ACCOUNT_ID set, will fetch all accounts');
    }

    console.log('Fetching sample insights from Meta API...\n');

    const today = new Date().toISOString().split('T')[0];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Use the Gran Acuario account which has the most data
    const accountId = META_AD_ACCOUNT_ID || 'act_2403366893012919';
    console.log(`Using account: ${accountId}\n`);

    const url = `https://graph.facebook.com/v21.0/${accountId}/insights?level=ad&time_range={"since":"${ninetyDaysAgo}","until":"${today}"}&fields=ad_id,ad_name,date_start,spend,impressions&limit=100&access_token=${META_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('❌ Meta API Error:', data.error.message);
      process.exit(1);
    }

    console.log(`✓ Fetched ${data.data?.length || 0} insights from API\n`);

    if (!data.data || data.data.length === 0) {
      console.log('ℹ️  No insights returned from Meta API');
      return;
    }

    // Extract unique ad_ids from insights
    const insightAdIds = new Set<string>();
    data.data.forEach((insight: any) => {
      if (insight.ad_id) {
        insightAdIds.add(insight.ad_id);
      }
    });

    console.log(`Found ${insightAdIds.size} unique ad IDs in insights\n`);
    console.log('Sample ad IDs from insights:', Array.from(insightAdIds).slice(0, 5));

    // Check which ad IDs exist in our database
    const existingAds = await prisma.metaAd.findMany({
      where: {
        id: {
          in: Array.from(insightAdIds),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`\n✓ Found ${existingAds.length}/${insightAdIds.size} ads in our database`);

    // Check campaign IDs and adset IDs too
    console.log('\n=== Checking Campaign and Adset IDs ===');

    const insightCampaignIds = new Set<string>();
    const insightAdsetIds = new Set<string>();
    data.data.forEach((insight: any) => {
      if (insight.campaign_id) insightCampaignIds.add(insight.campaign_id);
      if (insight.adset_id) insightAdsetIds.add(insight.adset_id);
    });

    const existingCampaigns = await prisma.metaCampaign.findMany({
      where: { id: { in: Array.from(insightCampaignIds) } },
      select: { id: true },
    });

    const existingAdsets = await prisma.metaAdset.findMany({
      where: { id: { in: Array.from(insightAdsetIds) } },
      select: { id: true },
    });

    const existingCampaignIds = new Set(existingCampaigns.map(c => c.id));
    const existingAdsetIds = new Set(existingAdsets.map(a => a.id));

    const missingCampaignIds = Array.from(insightCampaignIds).filter(id => !existingCampaignIds.has(id));
    const missingAdsetIds = Array.from(insightAdsetIds).filter(id => !existingAdsetIds.has(id));

    console.log(`Campaigns: ${existingCampaigns.length}/${insightCampaignIds.size} exist in DB (${missingCampaignIds.length} missing)`);
    console.log(`Adsets: ${existingAdsets.length}/${insightAdsetIds.size} exist in DB (${missingAdsetIds.length} missing)`);

    // Find missing ad IDs
    const existingAdIds = new Set(existingAds.map(ad => ad.id));
    const missingAdIds = Array.from(insightAdIds).filter(id => !existingAdIds.has(id));

    if (missingAdIds.length > 0 || missingCampaignIds.length > 0 || missingAdsetIds.length > 0) {
      console.log(`\n⚠️  FOUND MISSING REFERENCES:`);
      console.log(`  - ${missingAdIds.length}/${insightAdIds.size} ad IDs missing (${Math.round(missingAdIds.length/insightAdIds.size*100)}%)`);
      console.log(`  - ${missingCampaignIds.length}/${insightCampaignIds.size} campaign IDs missing (${Math.round(missingCampaignIds.length/insightCampaignIds.size*100)}%)`);
      console.log(`  - ${missingAdsetIds.length}/${insightAdsetIds.size} adset IDs missing (${Math.round(missingAdsetIds.length/insightAdsetIds.size*100)}%)`);

      if (missingAdIds.length > 0) {
        console.log('\n Missing ad IDs (first 10):');
        missingAdIds.slice(0, 10).forEach(id => {
          const insight = data.data.find((i: any) => i.ad_id === id);
          console.log(`  - ${id} (${insight?.ad_name || 'unknown'})`);
        });
      }

      // Check if these ads exist in Meta API
      console.log('\n\nChecking if these missing ads exist in Meta API...');

      const adsInAccount = await fetch(
        `https://graph.facebook.com/v21.0/${accountId}/ads?fields=id,name,status,created_time&limit=1000&access_token=${META_ACCESS_TOKEN}`
      );
      const adsData = await adsInAccount.json();

      if (adsData.data) {
        const apiAdIds = new Set(adsData.data.map((ad: any) => ad.id));
        const missingInApi = missingAdIds.filter(id => !apiAdIds.has(id));
        const existInApi = missingAdIds.filter(id => apiAdIds.has(id));

        console.log(`\n✓ ${existInApi.length} missing ads DO exist in Meta API`);
        console.log(`✗ ${missingInApi.length} missing ads DON'T exist in Meta API (deleted/archived)`);

        if (existInApi.length > 0) {
          console.log('\n⚠️  SOLUTION: We need to fetch and save these ads that exist in the API but are missing from our database:');
          console.log('Sample ads that need to be fetched:');
          existInApi.slice(0, 5).forEach(id => {
            const ad = adsData.data.find((a: any) => a.id === id);
            console.log(`  - ${id} (${ad?.name}, created: ${ad?.created_time?.split('T')[0] || 'unknown'})`);
          });
        }
      }
    } else {
      console.log('\n✓ All ad IDs from insights exist in our database!');
    }

    // Check total ads in our database
    const totalAdsInDb = await prisma.metaAd.count();
    console.log(`\n\nDatabase stats:`);
    console.log(`  Total ads in DB: ${totalAdsInDb}`);
    console.log(`  Ads with insights: ${insightAdIds.size}`);
    console.log(`  Ads missing: ${missingAdIds.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseInsights();
