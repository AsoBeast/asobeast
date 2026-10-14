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

  it('stores no row for the home localization the field saved before the upgrade belongs to', async () => {
    await expect(prisma.appLocalization.findMany()).resolves.toEqual([]);
  });
});
