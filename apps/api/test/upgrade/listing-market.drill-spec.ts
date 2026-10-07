import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Listing markets against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reads every snapshot written before the upgrade as a home listing', async () => {
    const [all, markets] = await Promise.all([
      prisma.appSnapshot.count(),
      prisma.appSnapshot.count({
        where: {
          country: { not: null },
          id: { not: { startsWith: 'snap_market_' } },
        },
      }),
    ]);

    expect(all).toBeGreaterThan(0);
    expect(markets).toBe(0);
  });

  it('reads every change event written before the upgrade as a home change', async () => {
    await expect(
      prisma.changeEvent.count({ where: { country: { not: null } } }),
    ).resolves.toBe(0);
  });
});
