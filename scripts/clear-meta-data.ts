import prisma from '../lib/prisma';

async function clearMetaData() {
  console.log('Clearing Meta data from database...');

  try {
    // Delete in correct order (respecting foreign keys)
    await prisma.metaInsightDaily.deleteMany({});
    console.log('✓ Cleared insights');

    await prisma.metaAd.deleteMany({});
    console.log('✓ Cleared ads');

    await prisma.metaAdset.deleteMany({});
    console.log('✓ Cleared adsets');

    await prisma.metaCampaign.deleteMany({});
    console.log('✓ Cleared campaigns');

    await prisma.metaAccount.deleteMany({});
    console.log('✓ Cleared accounts');

    // Optionally clear sync runs
    const clearSyncs = process.argv.includes('--clear-syncs');
    if (clearSyncs) {
      await prisma.syncRun.deleteMany({});
      console.log('✓ Cleared sync runs');
    }

    console.log('\n✅ Database cleared successfully!');
    console.log('You can now run a new sync with the date filter (2024+)');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearMetaData();
