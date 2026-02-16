import { sleep } from '../utils';
import type {
  MetaAccount,
  MetaCampaign,
  MetaAdset,
  MetaAd,
  MetaInsights,
} from '../types';

const META_API_VERSION = 'v21.0';
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

interface MetaAPIError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface MetaPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

export class MetaAPIClient {
  private accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.META_ACCESS_TOKEN || '';
    if (!this.accessToken) {
      throw new Error('Meta access token is required');
    }
  }

  private async fetchWithRetry<T>(
    url: string,
    retryCount = 0
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 }, // Disable caching for API calls
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = errorData.error as MetaAPIError | undefined;

        // Handle rate limiting (error code 17 or 80000/80001/80004)
        if (
          response.status === 429 ||
          error?.code === 17 ||
          error?.code === 80000 ||
          error?.code === 80001 ||
          error?.code === 80004
        ) {
          if (retryCount < MAX_RETRIES) {
            const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
            console.log(`Rate limited. Retrying in ${backoffMs}ms...`);
            await sleep(backoffMs);
            return this.fetchWithRetry<T>(url, retryCount + 1);
          }
        }

        throw new Error(
          `Meta API Error: ${error?.message || response.statusText} (code: ${error?.code || response.status})`
        );
      }

      return await response.json();
    } catch (error) {
      if (retryCount < MAX_RETRIES && error instanceof Error) {
        // Retry on network errors
        if (error.message.includes('fetch failed') || error.message.includes('ECONNRESET')) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
          console.log(`Network error. Retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          return this.fetchWithRetry<T>(url, retryCount + 1);
        }
      }
      throw error;
    }
  }

  private buildUrl(path: string, params: Record<string, any> = {}): string {
    const url = new URL(`${META_API_BASE_URL}${path}`);
    url.searchParams.append('access_token', this.accessToken);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });

    return url.toString();
  }

  private async fetchAllPages<T>(
    initialUrl: string
  ): Promise<T[]> {
    const results: T[] = [];
    const seenUrls = new Set<string>();
    let url: string | null = initialUrl;
    let pageCount = 0;
    const MAX_PAGES = 100; // Safety limit

    while (url && pageCount < MAX_PAGES) {
      // Prevent infinite loops by checking for duplicate URLs
      if (seenUrls.has(url)) {
        console.warn('Detected duplicate pagination URL, stopping to prevent infinite loop');
        break;
      }
      seenUrls.add(url);
      pageCount++;

      const response: MetaPaginatedResponse<T> = await this.fetchWithRetry<MetaPaginatedResponse<T>>(url);

      // If no data returned, stop pagination
      if (!response.data || response.data.length === 0) {
        break;
      }

      results.push(...response.data);
      console.log(`Fetched page ${pageCount}, ${response.data.length} items (total: ${results.length})`);

      // Get next page URL
      url = response.paging?.next || null;
    }

    if (pageCount >= MAX_PAGES) {
      console.warn(`Reached maximum page limit (${MAX_PAGES}), stopping pagination`);
    }

    return results;
  }

  /**
   * Fetch ad accounts accessible by the access token
   */
  async fetchAccounts(): Promise<MetaAccount[]> {
    const url = this.buildUrl('/me/adaccounts', {
      fields: 'id,name,currency,timezone_name',
    });

    return this.fetchAllPages<MetaAccount>(url);
  }

  /**
   * Fetch campaigns for an ad account
   */
  async fetchCampaigns(
    accountId: string,
    params?: {
      since?: string;
      fields?: string[];
    }
  ): Promise<MetaCampaign[]> {
    const fields = params?.fields || [
      'id',
      'name',
      'status',
      'objective',
      'created_time',
      'start_time',
      'stop_time',
      'updated_time',
    ];

    const url = this.buildUrl(`/${accountId}/campaigns`, {
      fields: fields,
      limit: 100,
      ...(params?.since && { filtering: JSON.stringify([{
        field: 'updated_time',
        operator: 'GREATER_THAN',
        value: params.since,
      }]) }),
    });

    return this.fetchAllPages<MetaCampaign>(url);
  }

  /**
   * Fetch ad sets for an ad account
   */
  async fetchAdsets(
    accountId: string,
    params?: {
      since?: string;
      fields?: string[];
    }
  ): Promise<MetaAdset[]> {
    const fields = params?.fields || [
      'id',
      'name',
      'status',
      'campaign_id',
      'targeting',
      'billing_event',
      'optimization_goal',
      'bid_amount',
      'created_time',
      'start_time',
      'end_time',
      'updated_time',
    ];

    const url = this.buildUrl(`/${accountId}/adsets`, {
      fields: fields,
      limit: 100,
      ...(params?.since && { filtering: JSON.stringify([{
        field: 'updated_time',
        operator: 'GREATER_THAN',
        value: params.since,
      }]) }),
    });

    return this.fetchAllPages<MetaAdset>(url);
  }

  /**
   * Fetch ads for an ad account
   */
  async fetchAds(
    accountId: string,
    params?: {
      since?: string;
      fields?: string[];
    }
  ): Promise<MetaAd[]> {
    const fields = params?.fields || [
      'id',
      'name',
      'status',
      'adset_id',
      'campaign_id',
      'creative',
      'created_time',
      'updated_time',
    ];

    const url = this.buildUrl(`/${accountId}/ads`, {
      fields: fields,
      limit: 100,
      ...(params?.since && { filtering: JSON.stringify([{
        field: 'updated_time',
        operator: 'GREATER_THAN',
        value: params.since,
      }]) }),
    });

    return this.fetchAllPages<MetaAd>(url);
  }

  /**
   * Fetch insights for an account/campaign/adset/ad
   */
  async fetchInsights(
    objectId: string,
    params: {
      level?: 'account' | 'campaign' | 'adset' | 'ad';
      datePreset?: string;
      timeRange?: {
        since: string; // YYYY-MM-DD
        until: string; // YYYY-MM-DD
      };
      fields?: string[];
      breakdowns?: string[];
    }
  ): Promise<MetaInsights[]> {
    const fields = params.fields || [
      'impressions',
      'reach',
      'clicks',
      'spend',
      'cpc',
      'cpm',
      'ctr',
      'frequency',
      'actions',
      'action_values',
    ];

    const queryParams: Record<string, any> = {
      fields: fields,
      limit: 100,
    };

    if (params.level) {
      queryParams.level = params.level;
    }

    if (params.datePreset) {
      queryParams.date_preset = params.datePreset;
    } else if (params.timeRange) {
      queryParams.time_range = JSON.stringify(params.timeRange);
    }

    if (params.breakdowns) {
      queryParams.breakdowns = params.breakdowns;
    }

    // Add time_increment for daily breakdown
    queryParams.time_increment = 1;

    const url = this.buildUrl(`/${objectId}/insights`, queryParams);

    return this.fetchAllPages<MetaInsights>(url);
  }

  /**
   * Fetch insights for multiple ads in bulk (more efficient)
   */
  async fetchBulkInsights(
    accountId: string,
    params: {
      level: 'account' | 'campaign' | 'adset' | 'ad';
      timeRange: {
        since: string;
        until: string;
      };
      fields?: string[];
    }
  ): Promise<MetaInsights[]> {
    return this.fetchInsights(accountId, params);
  }
}

// Singleton instance with default token
let defaultClient: MetaAPIClient | null = null;

export function getMetaClient(accessToken?: string): MetaAPIClient {
  if (!accessToken && !defaultClient) {
    defaultClient = new MetaAPIClient();
  }
  return accessToken ? new MetaAPIClient(accessToken) : defaultClient!;
}
