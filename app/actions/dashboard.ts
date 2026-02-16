'use server';

import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { parseDecimal, parseBigInt } from '@/lib/utils';
import type { DashboardFilters, DashboardMetrics, TimeSeriesDataPoint } from '@/lib/types';

export async function getDashboardMetrics(filters?: DashboardFilters): Promise<DashboardMetrics> {
  await getCurrentUser();

  const where: Prisma.MetaInsightDailyWhereInput = {};

  if (filters?.accountId) {
    where.accountId = filters.accountId;
  }

  if (filters?.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters?.adsetId) {
    where.adsetId = filters.adsetId;
  }

  if (filters?.dateRange) {
    where.date = {
      gte: new Date(filters.dateRange.from),
      lte: new Date(filters.dateRange.to),
    };
  }

  const aggregation = await prisma.metaInsightDaily.aggregate({
    where,
    _sum: {
      spend: true,
      purchases: true,
      purchaseValue: true,
      impressions: true,
      clicks: true,
      reach: true,
      linkClicks: true,
    },
    _avg: {
      cpc: true,
      cpm: true,
      ctr: true,
    },
  });

  const spend = parseDecimal(aggregation._sum.spend);
  const purchaseValue = parseDecimal(aggregation._sum.purchaseValue);
  const roas = spend > 0 ? purchaseValue / spend : 0;

  return {
    spend,
    purchases: aggregation._sum.purchases || 0,
    roas,
    ctr: parseDecimal(aggregation._avg.ctr),
    cpc: parseDecimal(aggregation._avg.cpc),
    cpm: parseDecimal(aggregation._avg.cpm),
    impressions: parseBigInt(aggregation._sum.impressions),
    clicks: aggregation._sum.clicks || 0,
    reach: parseBigInt(aggregation._sum.reach),
    linkClicks: aggregation._sum.linkClicks || 0,
  };
}

export async function getTimeSeriesData(filters?: DashboardFilters): Promise<TimeSeriesDataPoint[]> {
  await getCurrentUser();

  const where: Prisma.MetaInsightDailyWhereInput = {};

  if (filters?.accountId) {
    where.accountId = filters.accountId;
  }

  if (filters?.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters?.adsetId) {
    where.adsetId = filters.adsetId;
  }

  if (filters?.dateRange) {
    where.date = {
      gte: new Date(filters.dateRange.from),
      lte: new Date(filters.dateRange.to),
    };
  }

  const insights = await prisma.metaInsightDaily.groupBy({
    by: ['date'],
    where,
    _sum: {
      spend: true,
      purchases: true,
      purchaseValue: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  return insights.map((insight) => {
    const spend = parseDecimal(insight._sum.spend);
    const purchaseValue = parseDecimal(insight._sum.purchaseValue);
    const roas = spend > 0 ? purchaseValue / spend : 0;

    return {
      date: insight.date.toISOString().split('T')[0],
      spend,
      purchases: insight._sum.purchases || 0,
      roas,
    };
  });
}

export async function getCampaignMetrics(filters?: DashboardFilters) {
  await getCurrentUser();

  const where: Prisma.MetaInsightDailyWhereInput = {};

  if (filters?.accountId) {
    where.accountId = filters.accountId;
  }

  if (filters?.dateRange) {
    where.date = {
      gte: new Date(filters.dateRange.from),
      lte: new Date(filters.dateRange.to),
    };
  }

  const campaigns = await prisma.metaCampaign.findMany({
    where: {
      ...(filters?.accountId && { accountId: filters.accountId }),
    },
    include: {
      insights: {
        where: filters?.dateRange ? {
          date: {
            gte: new Date(filters.dateRange.from),
            lte: new Date(filters.dateRange.to),
          },
        } : undefined,
      },
    },
  });

  return campaigns.map((campaign) => {
    const metrics = campaign.insights.reduce(
      (acc, insight) => {
        acc.spend += parseDecimal(insight.spend);
        acc.purchases += insight.purchases;
        acc.purchaseValue += parseDecimal(insight.purchaseValue);
        acc.impressions += parseBigInt(insight.impressions);
        acc.clicks += insight.clicks;
        return acc;
      },
      { spend: 0, purchases: 0, purchaseValue: 0, impressions: 0, clicks: 0 }
    );

    const roas = metrics.spend > 0 ? metrics.purchaseValue / metrics.spend : 0;
    const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      spend: metrics.spend,
      purchases: metrics.purchases,
      roas,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      ctr,
    };
  });
}

export async function getAccounts() {
  await getCurrentUser();

  const accounts = await prisma.metaAccount.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return accounts;
}
