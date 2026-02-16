import prisma from '../lib/prisma';

async function checkAdDates() {
  try {
    // Check date range of ads in database
    const adStats = await prisma.metaAd.aggregate({
      _min: { createdTime: true },
      _max: { createdTime: true },
      _count: true,
    });

    console.log('=== Ads in Database ===');
    console.log(`Total ads: ${adStats._count}`);
    console.log(`Oldest ad created: ${adStats._min.createdTime?.toISOString().split('T')[0] || 'N/A'}`);
    console.log(`Newest ad created: ${adStats._max.createdTime?.toISOString().split('T')[0] || 'N/A'}`);

    // Check how many ads were created before 2025
    const adsBefore2025 = await prisma.metaAd.count({
      where: {
        createdTime: {
          lt: new Date('2025-01-01'),
        },
      },
    });

    console.log(`\nAds created before 2025-01-01: ${adsBefore2025}`);
    console.log(`Ads created since 2025-01-01: ${adStats._count - adsBefore2025}`);

    // Sample some ads
    const sampleAds = await prisma.metaAd.findMany({
      select: {
        id: true,
        name: true,
        createdTime: true,
      },
      orderBy: { createdTime: 'asc' },
      take: 5,
    });

    console.log('\n=== Sample Oldest Ads ===');
    sampleAds.forEach(ad => {
      console.log(`${ad.id}: ${ad.name} (created: ${ad.createdTime?.toISOString().split('T')[0] || 'N/A'})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdDates();
