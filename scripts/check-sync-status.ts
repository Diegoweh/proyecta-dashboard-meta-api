import prisma from '../lib/prisma';

async function checkSyncStatus() {
  try {
    const latestSync = await prisma.syncRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    if (!latestSync) {
      console.log('No sync runs found');
      return;
    }

    console.log('\n=== Latest Sync Run ===');
    console.log(`Status: ${latestSync.status}`);
    console.log(`Started: ${latestSync.startedAt}`);
    console.log(`Finished: ${latestSync.finishedAt || 'Still running'}`);
    console.log(`\nCounts:`);
    console.log(`  Accounts: ${latestSync.accountsCount}`);
    console.log(`  Campaigns: ${latestSync.campaignsCount}`);
    console.log(`  Adsets: ${latestSync.adsetsCount}`);
    console.log(`  Ads: ${latestSync.adsCount}`);
    console.log(`  Insights: ${latestSync.insightsCount}`);
    
    if (latestSync.error) {
      console.log(`\nError: ${latestSync.error}`);
    }

    if (latestSync.startedAt && latestSync.finishedAt) {
      const duration = (latestSync.finishedAt.getTime() - latestSync.startedAt.getTime()) / 1000;
      console.log(`\nDuration: ${duration}s`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSyncStatus();
