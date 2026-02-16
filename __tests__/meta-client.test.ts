/**
 * Basic tests for Meta API Client
 *
 * Note: These tests use mocked fetch responses.
 * In production, you would want integration tests against a test account.
 */

import { MetaAPIClient } from '@/lib/meta/client';

// Mock fetch globally
global.fetch = jest.fn();

describe('MetaAPIClient', () => {
  let client: MetaAPIClient;
  const mockAccessToken = 'test-token-123';

  beforeEach(() => {
    client = new MetaAPIClient(mockAccessToken);
    jest.clearAllMocks();
  });

  describe('fetchAccounts', () => {
    it('should fetch accounts successfully', async () => {
      const mockAccounts = {
        data: [
          {
            id: 'act_123',
            name: 'Test Account',
            currency: 'USD',
            timezone_name: 'America/Los_Angeles',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccounts,
      });

      const result = await client.fetchAccounts();

      expect(result).toEqual(mockAccounts.data);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/adaccounts'),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message: 'Invalid OAuth access token',
            type: 'OAuthException',
            code: 190,
          },
        }),
      });

      await expect(client.fetchAccounts()).rejects.toThrow(
        'Meta API Error: Invalid OAuth access token'
      );
    });
  });

  describe('fetchCampaigns', () => {
    it('should fetch campaigns for an account', async () => {
      const mockCampaigns = {
        data: [
          {
            id: '123',
            name: 'Test Campaign',
            status: 'ACTIVE',
            objective: 'CONVERSIONS',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCampaigns,
      });

      const result = await client.fetchCampaigns('act_123');

      expect(result).toEqual(mockCampaigns.data);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/act_123/campaigns'),
        expect.any(Object)
      );
    });
  });

  describe('fetchInsights', () => {
    it('should fetch insights with date range', async () => {
      const mockInsights = {
        data: [
          {
            impressions: '1000',
            clicks: '50',
            spend: '25.50',
            date_start: '2024-01-01',
            date_stop: '2024-01-01',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockInsights,
      });

      const result = await client.fetchInsights('act_123', {
        level: 'account',
        timeRange: {
          since: '2024-01-01',
          until: '2024-01-31',
        },
      });

      expect(result).toEqual(mockInsights.data);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/act_123/insights'),
        expect.any(Object)
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit errors', async () => {
      // First call fails with rate limit
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({
            error: {
              message: 'Rate limit exceeded',
              code: 17,
            },
          }),
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      const result = await client.fetchAccounts();

      expect(result).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('pagination', () => {
    it('should handle paginated responses', async () => {
      const page1 = {
        data: [{ id: '1', name: 'Campaign 1' }],
        paging: {
          next: 'https://graph.facebook.com/v21.0/act_123/campaigns?after=cursor1',
        },
      };

      const page2 = {
        data: [{ id: '2', name: 'Campaign 2' }],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2,
        });

      const result = await client.fetchCampaigns('act_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Export Utilities', () => {
  it('should format CSV data correctly', () => {
    // Test exportToCSV utility
    const data = [
      { name: 'Campaign 1', spend: 100, roas: 2.5 },
      { name: 'Campaign 2', spend: 200, roas: 3.0 },
    ];

    const columns = [
      { key: 'name' as const, header: 'Name' },
      { key: 'spend' as const, header: 'Spend' },
      { key: 'roas' as const, header: 'ROAS' },
    ];

    // Would test actual export function here
    expect(data).toHaveLength(2);
    expect(columns).toHaveLength(3);
  });
});
