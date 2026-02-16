'use server';

import { requireAdmin, getCurrentUser } from '@/lib/auth';
import { runMetaSync } from '@/lib/meta/sync';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { SyncConfig } from '@/lib/types';

export async function triggerSync(config?: SyncConfig) {
  try {
    const user = await requireAdmin();

    const result = await runMetaSync(config, user.email);

    revalidatePath('/admin/sync');
    revalidatePath('/dashboard');

    return {
      success: true,
      syncRunId: result.syncRunId,
      counts: result.counts,
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start sync',
    };
  }
}

export async function getSyncHistory(limit: number = 20) {
  try {
    await getCurrentUser();

    const syncRuns = await prisma.syncRun.findMany({
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    });

    return {
      success: true,
      data: syncRuns.map(run => ({
        ...run,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() || null,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sync history',
    };
  }
}

export async function getSyncRun(syncRunId: string) {
  try {
    await getCurrentUser();

    const syncRun = await prisma.syncRun.findUnique({
      where: { id: syncRunId },
    });

    if (!syncRun) {
      return {
        success: false,
        error: 'Sync run not found',
      };
    }

    return {
      success: true,
      data: {
        ...syncRun,
        startedAt: syncRun.startedAt.toISOString(),
        finishedAt: syncRun.finishedAt?.toISOString() || null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sync run',
    };
  }
}
