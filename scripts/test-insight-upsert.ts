import prisma from '../lib/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read .env file manually
const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    acc[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return acc;
}, {} as Record<string, string>);

async function testInsightUpsert() {
  try {
    const META_ACCESS_TOKEN = envVars.META_ACCESS_TOKEN;
    const accountId = 'act_2403366893012919'; // Gran Acuario

    console.log('Fetching a single insight from Meta API...\n');

    const today = new Date().toISOString().split('T')[0];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const url = `https://graph.facebook.com/v21.0/${accountId}/insights?level=ad&time_range={"since":"${ninetyDaysAgo}","until":"${today}"}&fields=ad_id,ad_name,date_start,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values&limit=10&access_token=${META_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.log('No insights returned');
      return;
    }

    // Find an insight whose ad exists in our database
    let validInsight = null;
    for (const insight of data.data) {
      const adExists = await prisma.metaAd.findUnique({
        where: { id: insight.ad_id },
      });

      if (adExists) {
        validInsight = insight;
        console.log(`✓ Found valid insight with ad_id: ${insight.ad_id} (${adExists.name})\n`);
        break;
      } else {
        console.log(`✗ Skipping insight with deleted ad_id: ${insight.ad_id}`);
      }
    }

    if (!validInsight) {
      console.log('❌ No insights found with valid ad IDs');
      return;
    }

    // Now try to upsert this insight
    console.log('Attempting to upsert insight...\n');
    console.log('Insight data:', JSON.stringify(validInsight, null, 2));

    const date = validInsight.date_start ? new Date(validInsight.date_start) : new Date();

    console.log('\nParsed date:', date.toISOString());
    console.log('Ad ID:', validInsight.ad_id);
    console.log('Account ID:', accountId);

    try {
      const result = await prisma.metaInsightDaily.upsert({
        where: {
          adId_date: {
            adId: validInsight.ad_id,
            date,
          },
        },
        update: {
          impressions: BigInt(validInsight.impressions || 0),
          reach: BigInt(validInsight.reach || 0),
          clicks: parseInt(validInsight.clicks || '0', 10),
          spend: parseFloat(validInsight.spend || '0'),
          cpc: parseFloat(validInsight.cpc || '0'),
          cpm: parseFloat(validInsight.cpm || '0'),
          ctr: parseFloat(validInsight.ctr || '0'),
          frequency: parseFloat(validInsight.frequency || '0'),
        },
        create: {
          accountId,
          campaignId: validInsight.campaign_id,
          adsetId: validInsight.adset_id,
          adId: validInsight.ad_id,
          date,
          impressions: BigInt(validInsight.impressions || 0),
          reach: BigInt(validInsight.reach || 0),
          clicks: parseInt(validInsight.clicks || '0', 10),
          linkClicks: 0,
          spend: parseFloat(validInsight.spend || '0'),
          cpc: parseFloat(validInsight.cpc || '0'),
          cpm: parseFloat(validInsight.cpm || '0'),
          ctr: parseFloat(validInsight.ctr || '0'),
          frequency: parseFloat(validInsight.frequency || '0'),
          purchases: 0,
          purchaseValue: 0,
          roas: 0,
        },
      });

      console.log('\n✅ SUCCESS! Insight upserted successfully');
      console.log('Result ID:', result.id);
      console.log('Spend:', result.spend.toString());
      console.log('Impressions:', result.impressions.toString());

      // Verify it was saved
      const count = await prisma.metaInsightDaily.count();
      console.log(`\nTotal insights in database: ${count}`);

    } catch (upsertError) {
      console.error('\n❌ UPSERT FAILED!');
      console.error('Error:', upsertError);

      if (upsertError instanceof Error) {
        console.error('Error message:', upsertError.message);
        console.error('Error stack:', upsertError.stack);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInsightUpsert();
