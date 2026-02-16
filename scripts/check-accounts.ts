import prisma from '../lib/prisma';

async function checkAccounts() {
  try {
    const accounts = await prisma.metaAccount.findMany({
      include: {
        _count: {
          select: {
            campaigns: true,
            adsets: true,
            ads: true,
            insights: true,
          },
        },
      },
    });

    console.log(`\n=== Accounts in Database (${accounts.length} total) ===\n`);

    accounts.forEach(account => {
      console.log(`Account: ${account.id}`);
      console.log(`  Name: ${account.name}`);
      console.log(`  Campaigns: ${account._count.campaigns}`);
      console.log(`  Adsets: ${account._count.adsets}`);
      console.log(`  Ads: ${account._count.ads}`);
      console.log(`  Insights: ${account._count.insights}`);
      console.log('');
    });

    // Find accounts with the most data
    const accountsWithData = accounts
      .filter(a => a._count.campaigns > 0)
      .sort((a, b) => b._count.campaigns - a._count.campaigns);

    if (accountsWithData.length > 0) {
      console.log('=== Accounts with most campaigns ===\n');
      accountsWithData.slice(0, 5).forEach(account => {
        console.log(`${account.id} (${account.name}): ${account._count.campaigns} campaigns, ${account._count.ads} ads`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccounts();
