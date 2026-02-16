import prisma from '../lib/prisma';

async function checkData() {
  try {
    const [campaignsCount, insightsCount] = await Promise.all([
      prisma.metaCampaign.count(),
      prisma.metaInsightDaily.count(),
    ]);

    console.log('\n=== Database Status ===');
    console.log(`Campaigns: ${campaignsCount}`);
    console.log(`Insights: ${insightsCount}`);

    if (campaignsCount > 0) {
      const sampleCampaign = await prisma.metaCampaign.findFirst({
        include: {
          insights: {
            take: 5,
          },
        },
      });
      console.log(`\nSample campaign: ${sampleCampaign?.name}`);
      console.log(`Insights for this campaign: ${sampleCampaign?.insights.length}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
