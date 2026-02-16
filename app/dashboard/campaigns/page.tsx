import { getCampaignMetrics, getAccounts } from '@/app/actions/dashboard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber, formatPercentage, getDefaultDateRange } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

export default async function CampaignsPage({
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

  const [campaigns, accounts] = await Promise.all([
    getCampaignMetrics(filters),
    getAccounts(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            View and analyze campaign performance
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Purchases</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">CTR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No campaigns found
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        campaign.status === 'ACTIVE'
                          ? 'default'
                          : campaign.status === 'PAUSED'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(campaign.spend)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(campaign.purchases)}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.roas.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(campaign.impressions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(campaign.clicks)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentage(campaign.ctr)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
