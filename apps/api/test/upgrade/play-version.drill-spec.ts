import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Google Play versions against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const versionOf = async (id: string) =>
    (
      await prisma.appSnapshot.findUniqueOrThrow({
        where: { id },
        select: { version: true },
      })
    ).version;

  it('clears the marker a stored snapshot kept for a version that varies by device', async () => {
    await expect(versionOf('snap_play_escaped')).resolves.toBeNull();
  });

  it('leaves a real version as it was', async () => {
    await expect(versionOf('snap_ios_new')).resolves.toBe('1.1.0');
  });
});
