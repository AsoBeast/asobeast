import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Keyword fields against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps the field saved before the upgrade under the home default localization', async () => {
    await expect(
      prisma.keywordField.findMany({
        select: { appId: true, localization: true, phrases: true },
      }),
    ).resolves.toEqual([
      { appId: 'app_ios', localization: 'en-US', phrases: ['workout tracker'] },
    ]);
  });
});
