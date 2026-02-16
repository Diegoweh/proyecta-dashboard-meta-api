import prisma from '../lib/prisma';

async function checkAds() {
  const adsCount = await prisma.metaAd.count();
  console.log(`Total Ads: ${adsCount}`);

  if (adsCount > 0) {
    const sampleAd = await prisma.metaAd.findFirst({
      select: { id: true, name: true, accountId: true, campaignId: true },
    });
    console.log('Sample Ad:', sampleAd);
  }

  await prisma.$disconnect();
}

checkAds();
