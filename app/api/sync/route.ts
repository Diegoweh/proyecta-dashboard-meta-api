/**
 * API Route for Automated Sync
 *
 * This endpoint can be called by:
 * - GitHub Actions cron job
 * - Vercel Cron Jobs
 * - External schedulers
 *
 * Security: Requires SYNC_SECRET header for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMetaSync } from '@/lib/meta/sync';

export const maxDuration = 300; // 5 minutes max execution time

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.SYNC_SECRET}`;

    if (!process.env.SYNC_SECRET) {
      console.error('SYNC_SECRET not configured');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    if (authHeader !== expectedAuth) {
      console.error('Unauthorized sync attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body for optional config
    const body = await request.json().catch(() => ({}));
    const config = body.config || {};

    console.log('[API Sync] Starting automated sync...');

    // Run sync
    const result = await runMetaSync(config, 'automated');

    console.log(`[API Sync] Completed with status: ${result.status}`);

    if (result.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        syncRunId: result.syncRunId,
        counts: result.counts,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          syncRunId: result.syncRunId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// For manual testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Meta Sync API',
    status: 'ready',
    method: 'Use POST with Authorization header',
  });
}
