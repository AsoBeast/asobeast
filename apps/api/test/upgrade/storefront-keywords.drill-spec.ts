import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Keywords tracked outside a storefront against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const activeOf = async (appId: string, keywordId: string) =>
    (
      await prisma.trackedKeyword.findUniqueOrThrow({
        where: { appId_keywordId: { appId, keywordId } },
      })
    ).active;

  it('deactivates an app store keyword tracked in a code that is no storefront', async () => {
    expect(await activeOf('app_ios', 'kw_ios_zz')).toBe(false);
  });

  it('deactivates a google play keyword tracked in an app store only storefront', async () => {
    expect(await activeOf('app_play', 'kw_play_pw')).toBe(false);
  });

  it('keeps the ranking history of the keywords it deactivates', async () => {
    await expect(
      prisma.keywordRanking.count({
        where: { keywordId: { in: ['kw_ios_zz', 'kw_play_pw'] } },
      }),
    ).resolves.toBe(2);
  });

  it('leaves every keyword tracked in a storefront as it was', async () => {
    expect(await activeOf('app_ios', 'kw_ios_us')).toBe(true);
    expect(await activeOf('app_ios', 'kw_ios_gb')).toBe(true);
    expect(await activeOf('app_ios', 'kw_ios_us_alt')).toBe(false);
    expect(await activeOf('app_play', 'kw_play_us')).toBe(true);
    expect(await activeOf('app_rival', 'kw_ios_us')).toBe(true);
  });
});
