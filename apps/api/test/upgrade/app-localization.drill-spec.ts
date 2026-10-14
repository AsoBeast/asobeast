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

  it('keeps no app localization row because the field saved before the upgrade is the home one', async () => {
    await expect(prisma.appLocalization.findMany()).resolves.toEqual([]);
  });
});
