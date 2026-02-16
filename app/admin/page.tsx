import { requireAdmin } from '@/lib/auth';
import { getSyncHistory } from '@/app/actions/sync';
import { SyncButton } from '@/components/admin/sync-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export default async function AdminPage() {
  await requireAdmin();

  const result = await getSyncHistory(20);
  const syncRuns = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage Meta API sync and configurations
          </p>
        </div>
        <SyncButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Syncs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncRuns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {syncRuns.filter((run) => run.status === 'SUCCESS').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {syncRuns.filter((run) => run.status === 'FAILED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Recent sync runs and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Triggered By</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Campaigns</TableHead>
                <TableHead className="text-right">Insights</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No sync runs yet. Click &quot;Run Sync&quot; to start.
                  </TableCell>
                </TableRow>
              ) : (
                syncRuns.map((run) => {
                  const duration = run.finishedAt
                    ? Math.round(
                        (new Date(run.finishedAt).getTime() -
                          new Date(run.startedAt).getTime()) /
                          1000
                      )
                    : null;

                  return (
                    <TableRow key={run.id}>
                      <TableCell>{formatDate(run.startedAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            run.status === 'SUCCESS'
                              ? 'default'
                              : run.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.triggeredBy || 'System'}
                      </TableCell>
                      <TableCell className="text-right">{run.accountsCount}</TableCell>
                      <TableCell className="text-right">{run.campaignsCount}</TableCell>
                      <TableCell className="text-right">{run.insightsCount}</TableCell>
                      <TableCell>
                        {duration ? `${duration}s` : run.status === 'RUNNING' ? 'Running...' : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 max-w-md truncate">
                        {run.error || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
