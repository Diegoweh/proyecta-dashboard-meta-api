import prisma from '../lib/prisma';

async function checkInsightDates() {
  try {
    const insights = await prisma.metaInsightDaily.findMany({
      select: {
        date: true,
        spend: true,
        impressions: true,
      },
      orderBy: { date: 'desc' },
      take: 10,
    });

    console.log('\n=== Latest 10 Insights ===');
    insights.forEach(insight => {
      console.log(`Date: ${insight.date.toISOString().split('T')[0]}, Spend: ${insight.spend}, Impressions: ${insight.impressions}`);
    });

    const dateStats = await prisma.metaInsightDaily.aggregate({
      _min: { date: true },
      _max: { date: true },
      _sum: { spend: true },
      _count: true,
    });

    console.log('\n=== Date Range ===');
    console.log(`Oldest: ${dateStats._min.date?.toISOString().split('T')[0]}`);
    console.log(`Newest: ${dateStats._max.date?.toISOString().split('T')[0]}`);
    console.log(`Total Insights: ${dateStats._count}`);
    console.log(`Total Spend: $${dateStats._sum.spend || 0}`);

    // Check last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const last30DaysCount = await prisma.metaInsightDaily.count({
      where: {
        date: {
          gte: thirtyDaysAgo,
        },
      },
    });

    console.log(`\nInsights in last 30 days: ${last30DaysCount}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInsightDates();
