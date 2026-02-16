import prisma from '../prisma';
import { getMetaClient } from './client';
import type { SyncConfig } from '../types';
import { format, subDays } from 'date-fns';

interface SyncResult {
  syncRunId: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  counts: {
    accounts: number;
    campaigns: number;
    adsets: number;
    ads: number;
    insights: number;
  };
}

export class MetaSyncEngine {
  private client: ReturnType<typeof getMetaClient>;

  constructor(accessToken?: string) {
    this.client = getMetaClient(accessToken);
  }

  /**
   * Run a full sync of Meta Marketing data
   */
  async runSync(config: SyncConfig, triggeredBy?: string): Promise<SyncResult> {
    // Create sync run record
    const syncRun = await prisma.syncRun.create({
      data: {
        status: 'RUNNING',
        triggeredBy,
        metadata: config as any,
      },
    });

    const counts = {
      accounts: 0,
      campaigns: 0,
      adsets: 0,
      ads: 0,
      insights: 0,
    };

    try {
      const startTime = Date.now();
      const SYNC_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

      console.log(`[Sync ${syncRun.id}] Starting sync...`);

      // Get accounts to sync
      let accountIds = config.accountIds;

      // Check if we have a specific account ID in environment variable (ALWAYS use this if set)
      const envAccountId = process.env.META_AD_ACCOUNT_ID;

      if (envAccountId && (!accountIds || accountIds.length === 0)) {
        // Use ONLY the specific account from environment
        accountIds = [envAccountId];
        console.log(`[Sync ${syncRun.id}] Using specific account from environment: ${envAccountId}`);

        // Fetch account details to create the account record
        try {
          const accountUrl = `https://graph.facebook.com/v21.0/${envAccountId}?fields=id,name,currency,timezone_name&access_token=${process.env.META_ACCESS_TOKEN}`;
          const accountResponse = await fetch(accountUrl);
          if (accountResponse.ok) {
            const accountData = await accountResponse.json();
            await this.upsertAccount(accountData);
            counts.accounts = 1;
            console.log(`[Sync ${syncRun.id}] Account: ${accountData.name}`);
          } else {
            throw new Error(`Failed to fetch account details: ${accountResponse.statusText}`);
          }
        } catch (accountError) {
          console.warn(`Could not fetch account details: ${accountError}`);
          counts.accounts = 1;
        }
      } else if (!accountIds || accountIds.length === 0) {
        // Only try to fetch all accounts if no specific account is set
        try {
          const accounts = await this.client.fetchAccounts();
          accountIds = accounts.map((acc) => acc.id);

          // Upsert accounts
          for (const account of accounts) {
            await this.upsertAccount(account);
            counts.accounts++;
          }
          console.log(`[Sync ${syncRun.id}] Found ${accountIds.length} accessible accounts`);
        } catch (error) {
          throw new Error(
            'Failed to fetch accounts and no META_AD_ACCOUNT_ID set in .env. Error: ' +
            (error instanceof Error ? error.message : 'Unknown error')
          );
        }
      } else {
        counts.accounts = accountIds.length;
      }

      console.log(`[Sync ${syncRun.id}] Syncing ${accountIds.length} accounts`);

      // Determine date range for insights (last 90 days to capture more data)
      const dateRange = config.dateRange || {
        since: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
        until: format(new Date(), 'yyyy-MM-dd'),
      };

      console.log(`[Sync ${syncRun.id}] Insights date range: ${dateRange.since} to ${dateRange.until}`);

      // Sync each account
      for (const accountId of accountIds) {
        // Check for timeout
        if (Date.now() - startTime > SYNC_TIMEOUT_MS) {
          throw new Error('Sync timeout exceeded (10 minutes)');
        }

        console.log(`[Sync ${syncRun.id}] Syncing account ${accountId}...`);

        // Check if we already have campaigns for this account
        const existingCampaignsCount = await prisma.metaCampaign.count({
          where: { accountId },
        });

        // Only sync campaigns/adsets/ads if we don't have them yet (first sync)
        if (existingCampaignsCount === 0) {
          console.log(`[Sync ${syncRun.id}] First sync - fetching campaigns, adsets, and ads...`);

          // Sync campaigns in batches (only from 2025 onwards)
          const campaigns = await this.client.fetchCampaigns(accountId, {
            since: '2025-01-01',
          });
          console.log(`[Sync ${syncRun.id}] Fetched ${campaigns.length} campaigns from API (since 2025-01-01)`);

          await this.batchUpsertCampaigns(accountId, campaigns);
          counts.campaigns += campaigns.length;
          console.log(`[Sync ${syncRun.id}] Synced ${campaigns.length} campaigns to database`);

          // Sync adsets in batches (only from 2025 onwards)
          const adsets = await this.client.fetchAdsets(accountId, {
            since: '2025-01-01',
          });
          console.log(`[Sync ${syncRun.id}] Fetched ${adsets.length} adsets from API (since 2025-01-01)`);

          await this.batchUpsertAdsets(accountId, adsets);
          counts.adsets += adsets.length;
          console.log(`[Sync ${syncRun.id}] Synced ${adsets.length} adsets`);

          // Sync ads in batches (only from 2025 onwards)
          const ads = await this.client.fetchAds(accountId, {
            since: '2025-01-01',
          });
          console.log(`[Sync ${syncRun.id}] Fetched ${ads.length} ads from API (since 2025-01-01)`);

          await this.batchUpsertAds(accountId, ads);
          counts.ads += ads.length;
          console.log(`[Sync ${syncRun.id}] Synced ${ads.length} ads`);
        } else {
          console.log(`[Sync ${syncRun.id}] Skipping campaigns/adsets/ads sync (${existingCampaignsCount} campaigns already exist)`);
          counts.campaigns = existingCampaignsCount;
        }

        // Sync insights at ad level in batches
        console.log(`[Sync ${syncRun.id}] Fetching insights for date range: ${dateRange.since} to ${dateRange.until}`);
        const insights = await this.client.fetchBulkInsights(accountId, {
          level: 'ad',
          timeRange: dateRange,
        });
        console.log(`[Sync ${syncRun.id}] Fetched ${insights.length} insights from API`);

        if (insights.length === 0) {
          console.warn(`[Sync ${syncRun.id}] WARNING: No insights returned from Meta API for account ${accountId}`);
          console.warn(`[Sync ${syncRun.id}] This might mean: no ads ran in the date range, or ads have no performance data`);
        }

        await this.batchUpsertInsights(accountId, insights);
        counts.insights += insights.length;
        console.log(`[Sync ${syncRun.id}] Synced ${insights.length} insights`);
      }

      // Update sync run as successful
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          accountsCount: counts.accounts,
          campaignsCount: counts.campaigns,
          adsetsCount: counts.adsets,
          adsCount: counts.ads,
          insightsCount: counts.insights,
        },
      });

      console.log(`[Sync ${syncRun.id}] Sync completed successfully`);

      return {
        syncRunId: syncRun.id,
        status: 'SUCCESS',
        counts,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Sync ${syncRun.id}] Sync failed:`, errorMessage);

      // Update sync run as failed
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: errorMessage,
          accountsCount: counts.accounts,
          campaignsCount: counts.campaigns,
          adsetsCount: counts.adsets,
          adsCount: counts.ads,
          insightsCount: counts.insights,
        },
      });

      return {
        syncRunId: syncRun.id,
        status: 'FAILED',
        error: errorMessage,
        counts,
      };
    }
  }

  private async batchUpsertCampaigns(accountId: string, campaigns: any[]) {
    const BATCH_SIZE = 10; // Reduced to avoid connection pool exhaustion
    for (let i = 0; i < campaigns.length; i += BATCH_SIZE) {
      const batch = campaigns.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((campaign) => this.upsertCampaign(accountId, campaign))
      );
      console.log(`Processed ${Math.min(i + BATCH_SIZE, campaigns.length)}/${campaigns.length} campaigns`);
    }
  }

  private async batchUpsertAdsets(accountId: string, adsets: any[]) {
    const BATCH_SIZE = 10;
    for (let i = 0; i < adsets.length; i += BATCH_SIZE) {
      const batch = adsets.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((adset) => this.upsertAdset(accountId, adset))
      );
      console.log(`Processed ${Math.min(i + BATCH_SIZE, adsets.length)}/${adsets.length} adsets`);
    }
  }

  private async batchUpsertAds(accountId: string, ads: any[]) {
    const BATCH_SIZE = 10;
    for (let i = 0; i < ads.length; i += BATCH_SIZE) {
      const batch = ads.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((ad) => this.upsertAd(accountId, ad))
      );
      console.log(`Processed ${Math.min(i + BATCH_SIZE, ads.length)}/${ads.length} ads`);
    }
  }

  private async batchUpsertInsights(accountId: string, insights: any[]) {
    const BATCH_SIZE = 10;
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < insights.length; i += BATCH_SIZE) {
      const batch = insights.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (insight) => {
          try {
            const result = await this.upsertInsight(accountId, insight);
            if (result === 'skipped') {
              skipCount++;
            } else {
              successCount++;
            }
          } catch (error) {
            errorCount++;
            console.error(`Error upserting insight:`, error instanceof Error ? error.message : error);
          }
        })
      );
      console.log(`Processed ${Math.min(i + BATCH_SIZE, insights.length)}/${insights.length} insights (${successCount} success, ${skipCount} skipped, ${errorCount} errors)`);
    }
  }

  private async upsertAccount(account: any) {
    await prisma.metaAccount.upsert({
      where: { id: account.id },
      update: {
        name: account.name,
        currency: account.currency,
        timezone: account.timezone_name,
      },
      create: {
        id: account.id,
        name: account.name,
        currency: account.currency,
        timezone: account.timezone_name,
      },
    });
  }

  private async upsertCampaign(accountId: string, campaign: any) {
    await prisma.metaCampaign.upsert({
      where: { id: campaign.id },
      update: {
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        createdTime: campaign.created_time ? new Date(campaign.created_time) : null,
        startTime: campaign.start_time ? new Date(campaign.start_time) : null,
        stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
        updatedTime: campaign.updated_time ? new Date(campaign.updated_time) : null,
      },
      create: {
        id: campaign.id,
        accountId,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        createdTime: campaign.created_time ? new Date(campaign.created_time) : null,
        startTime: campaign.start_time ? new Date(campaign.start_time) : null,
        stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
        updatedTime: campaign.updated_time ? new Date(campaign.updated_time) : null,
      },
    });
  }

  private async upsertAdset(accountId: string, adset: any) {
    await prisma.metaAdset.upsert({
      where: { id: adset.id },
      update: {
        name: adset.name,
        status: adset.status,
        targeting: adset.targeting,
        billingEvent: adset.billing_event,
        optimizationGoal: adset.optimization_goal,
        bidAmount: adset.bid_amount,
        createdTime: adset.created_time ? new Date(adset.created_time) : null,
        startTime: adset.start_time ? new Date(adset.start_time) : null,
        endTime: adset.end_time ? new Date(adset.end_time) : null,
        updatedTime: adset.updated_time ? new Date(adset.updated_time) : null,
      },
      create: {
        id: adset.id,
        accountId,
        campaignId: adset.campaign_id,
        name: adset.name,
        status: adset.status,
        targeting: adset.targeting,
        billingEvent: adset.billing_event,
        optimizationGoal: adset.optimization_goal,
        bidAmount: adset.bid_amount,
        createdTime: adset.created_time ? new Date(adset.created_time) : null,
        startTime: adset.start_time ? new Date(adset.start_time) : null,
        endTime: adset.end_time ? new Date(adset.end_time) : null,
        updatedTime: adset.updated_time ? new Date(adset.updated_time) : null,
      },
    });
  }

  private async upsertAd(accountId: string, ad: any) {
    await prisma.metaAd.upsert({
      where: { id: ad.id },
      update: {
        name: ad.name,
        status: ad.status,
        creative: ad.creative,
        createdTime: ad.created_time ? new Date(ad.created_time) : null,
        updatedTime: ad.updated_time ? new Date(ad.updated_time) : null,
      },
      create: {
        id: ad.id,
        accountId,
        adsetId: ad.adset_id,
        campaignId: ad.campaign_id,
        name: ad.name,
        status: ad.status,
        creative: ad.creative,
        createdTime: ad.created_time ? new Date(ad.created_time) : null,
        updatedTime: ad.updated_time ? new Date(ad.updated_time) : null,
      },
    });
  }

  private async upsertInsight(accountId: string, insight: any): Promise<'success' | 'skipped'> {
    // Extract purchases and ROAS from actions
    let purchases = 0;
    let purchaseValue = 0;

    if (insight.actions) {
      const purchaseAction = insight.actions.find(
        (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      if (purchaseAction) {
        purchases = parseInt(purchaseAction.value, 10) || 0;
      }
    }

    if (insight.action_values) {
      const purchaseValueAction = insight.action_values.find(
        (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      if (purchaseValueAction) {
        purchaseValue = parseFloat(purchaseValueAction.value) || 0;
      }
    }

    const spend = parseFloat(insight.spend || '0');
    const roas = spend > 0 ? purchaseValue / spend : 0;

    // Determine the entity IDs
    // Insights can be at different levels, but we're fetching at ad level
    const adId = insight.ad_id;
    const adsetId = insight.adset_id;
    const campaignId = insight.campaign_id;
    const date = insight.date_start ? new Date(insight.date_start) : new Date();

    if (!adId) {
      console.warn('Insight missing ad_id, skipping');
      return 'skipped';
    }

    // Check if the ad exists in our database (to avoid foreign key constraint errors)
    const adExists = await prisma.metaAd.findUnique({
      where: { id: adId },
      select: { id: true },
    });

    if (!adExists) {
      // Skip insights for deleted/archived ads that don't exist in our database
      console.warn(`Skipping insight for deleted ad ${adId}`);
      return 'skipped';
    }

    await prisma.metaInsightDaily.upsert({
      where: {
        adId_date: {
          adId,
          date,
        },
      },
      update: {
        impressions: BigInt(insight.impressions || 0),
        reach: BigInt(insight.reach || 0),
        clicks: parseInt(insight.clicks || '0', 10),
        linkClicks: this.getLinkClicks(insight),
        spend,
        cpc: parseFloat(insight.cpc || '0'),
        cpm: parseFloat(insight.cpm || '0'),
        ctr: parseFloat(insight.ctr || '0'),
        frequency: parseFloat(insight.frequency || '0'),
        actions: insight.actions,
        actionValues: insight.action_values,
        purchases,
        purchaseValue,
        roas,
      },
      create: {
        accountId,
        campaignId,
        adsetId,
        adId,
        date,
        impressions: BigInt(insight.impressions || 0),
        reach: BigInt(insight.reach || 0),
        clicks: parseInt(insight.clicks || '0', 10),
        linkClicks: this.getLinkClicks(insight),
        spend,
        cpc: parseFloat(insight.cpc || '0'),
        cpm: parseFloat(insight.cpm || '0'),
        ctr: parseFloat(insight.ctr || '0'),
        frequency: parseFloat(insight.frequency || '0'),
        actions: insight.actions,
        actionValues: insight.action_values,
        purchases,
        purchaseValue,
        roas,
      },
    });

    return 'success';
  }

  private getLinkClicks(insight: any): number {
    if (insight.link_clicks) {
      return parseInt(insight.link_clicks, 10);
    }

    if (insight.actions) {
      const linkClickAction = insight.actions.find(
        (a: any) => a.action_type === 'link_click'
      );
      if (linkClickAction) {
        return parseInt(linkClickAction.value, 10) || 0;
      }
    }

    return 0;
  }
}

export async function runMetaSync(config?: SyncConfig, triggeredBy?: string): Promise<SyncResult> {
  const engine = new MetaSyncEngine();
  return engine.runSync(config || {}, triggeredBy);
}
