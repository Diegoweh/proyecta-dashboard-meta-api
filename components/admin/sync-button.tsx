'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { triggerSync } from '@/app/actions/sync';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setIsLoading(true);
    try {
      const result = await triggerSync();
      if (result.success) {
        alert(`Sync started successfully! Sync ID: ${result.syncRunId}`);
        router.refresh();
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSync} disabled={isLoading}>
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Running Sync...' : 'Run Sync'}
    </Button>
  );
}
