import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('App setups against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('gives every primary app of the baseline a not started row and no competitor one', async () => {
    const [primaries, setups] = await Promise.all([
      prisma.app.findMany({
        where: { isCompetitor: false },
        select: { id: true, country: true },
        orderBy: { id: 'asc' },
      }),
      prisma.appSetup.findMany({
        select: {
          appId: true,
          status: true,
          skipped: true,
          countriesReviewed: true,
          selectedMarkets: true,
          completedAt: true,
        },
        orderBy: { appId: 'asc' },
      }),
    ]);

    expect(primaries.length).toBeGreaterThan(0);
    expect(setups).toEqual(
      primaries.map((app) => ({
        appId: app.id,
        status: 'not_started',
        skipped: [],
        countriesReviewed: false,
        selectedMarkets: [app.country],
        completedAt: null,
      })),
    );
  });
});
