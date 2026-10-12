import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('App localizations against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('files the field saved before the upgrade as a manual localization', async () => {
    await expect(
      prisma.appLocalization.findMany({
        select: { appId: true, localization: true, origin: true },
      }),
    ).resolves.toEqual([
      { appId: 'app_ios', localization: 'en-US', origin: 'manual' },
    ]);
  });
});
