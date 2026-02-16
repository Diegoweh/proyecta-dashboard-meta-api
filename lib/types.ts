import { z } from 'zod';

// Date range filter
export const dateRangeSchema = z.object({
  from: z.string().or(z.date()),
  to: z.string().or(z.date()),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

// Dashboard filters
export const dashboardFiltersSchema = z.object({
  accountId: z.string().optional(),
  campaignId: z.string().optional(),
  adsetId: z.string().optional(),
  dateRange: dateRangeSchema.optional(),
});

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;

// Metrics
export interface DashboardMetrics {
  spend: number;
  purchases: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  impressions: number;
  clicks: number;
  reach: number;
  linkClicks: number;
}

// Time series data point
export interface TimeSeriesDataPoint {
  date: string;
  spend: number;
  purchases: number;
  roas: number;
}

// Campaign/Adset/Ad with metrics
export interface CampaignWithMetrics {
  id: string;
  name: string;
  status: string;
  spend: number;
  purchases: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface AdsetWithMetrics extends CampaignWithMetrics {
  campaignId: string;
  campaignName?: string;
}

export interface AdWithMetrics extends CampaignWithMetrics {
  adsetId: string;
  adsetName?: string;
  campaignId: string;
  campaignName?: string;
}

// Meta API response types
export interface MetaAccount {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  created_time?: string;
  start_time?: string;
  stop_time?: string;
  updated_time?: string;
}

export interface MetaAdset {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  targeting?: any;
  billing_event?: string;
  optimization_goal?: string;
  bid_amount?: number;
  created_time?: string;
  start_time?: string;
  end_time?: string;
  updated_time?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id?: string;
  creative?: any;
  created_time?: string;
  updated_time?: string;
}

export interface MetaInsights {
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
  action_values?: Array<{
    action_type: string;
    value: string;
  }>;
  date_start?: string;
  date_stop?: string;
}

// Sync configuration
export interface SyncConfig {
  accountIds?: string[];
  dateRange?: {
    since: string;
    until: string;
  };
  levels?: ('account' | 'campaign' | 'adset' | 'ad')[];
}
