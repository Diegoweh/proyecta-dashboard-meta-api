import { getDashboardMetrics, getTimeSeriesData, getAccounts } from '@/app/actions/dashboard';
import { MetricCard } from '@/components/dashboard/metric-card';
import { TimeSeriesChart } from '@/components/dashboard/time-series-chart';
import { DollarSign, ShoppingCart, TrendingUp, MousePointer, Eye, BarChart3 } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercentage, getDefaultDateRange } from '@/lib/utils';
import { Select } from '@/components/ui/select';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const params = await searchParams;
  const dateRange = getDefaultDateRange();

  const filters = {
    accountId: params.accountId,
    dateRange: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
  };

  const [metrics, timeSeriesData, accounts] = await Promise.all([
    getDashboardMetrics(filters),
    getTimeSeriesData(filters),
    getAccounts(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Meta Marketing API performance overview
          </p>
        </div>
        <div className="w-64">
          <Select name="accountId">
            <option value="">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Spend"
          value={formatCurrency(metrics.spend)}
          icon={DollarSign}
        />
        <MetricCard
          title="Purchases"
          value={formatNumber(metrics.purchases)}
          icon={ShoppingCart}
        />
        <MetricCard
          title="ROAS"
          value={metrics.roas.toFixed(2)}
          icon={TrendingUp}
        />
        <MetricCard
          title="CTR"
          value={formatPercentage(metrics.ctr)}
          icon={MousePointer}
        />
        <MetricCard
          title="Impressions"
          value={formatNumber(metrics.impressions)}
          icon={Eye}
        />
        <MetricCard
          title="CPC"
          value={formatCurrency(metrics.cpc)}
          icon={BarChart3}
        />
      </div>

      <TimeSeriesChart data={timeSeriesData} />
    </div>
  );
}
