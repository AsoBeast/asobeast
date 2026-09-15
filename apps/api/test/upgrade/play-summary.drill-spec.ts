import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Google Play short descriptions against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const snapshot = (id: string) =>
    prisma.appSnapshot.findUniqueOrThrow({
      where: { id },
      select: { summary: true, raw: true },
    });

  it('decodes the escapes a stored short description kept, exactly once', async () => {
    const { summary } = await snapshot('snap_play_escaped');

    expect(summary).toBe("Workouts & meals 'daily', amp tools, R&D &lt;3");
  });

  it('keeps the payload exactly as the store returned it', async () => {
    const { raw } = await snapshot('snap_play_escaped');

    expect(raw).toEqual({
      appId: 'com.drill.fitness',
      summary: 'Workouts &amp; meals &#39;daily&#39;, amp tools, R&D &amp;lt;3',
    });
  });

  const activeOf = async (keywordId: string) =>
    (
      await prisma.trackedKeyword.findUniqueOrThrow({
        where: { appId_keywordId: { appId: 'app_play', keywordId } },
      })
    ).active;

  it.each(['kw_play_amp_meals', 'kw_play_39_daily'])(
    'untracks %s, which only an escape in the short description produced',
    async (keywordId) => {
      expect(await activeOf(keywordId)).toBe(false);
    },
  );

  it.each([
    'kw_play_amp_tools',
    'kw_play_lt_3',
    'kw_play_amp',
    'kw_play_workouts',
  ])(
    'keeps %s, which the listing says or the owner chose',
    async (keywordId) => {
      expect(await activeOf(keywordId)).toBe(true);
    },
  );

  it('keeps the ranking history of the keywords it untracks', async () => {
    await expect(
      prisma.keywordRanking.count({
        where: { keywordId: { in: ['kw_play_amp_meals', 'kw_play_39_daily'] } },
      }),
    ).resolves.toBe(2);
  });

  it('leaves every other tracked keyword as it was', async () => {
    const others = await prisma.trackedKeyword.findMany({
      where: {
        keywordId: {
          in: ['kw_ios_us', 'kw_ios_gb', 'kw_ios_us_alt', 'kw_play_us'],
        },
      },
      select: { appId: true, keywordId: true, active: true },
      orderBy: [{ appId: 'asc' }, { keywordId: 'asc' }],
    });

    expect(others).toEqual([
      { appId: 'app_ios', keywordId: 'kw_ios_gb', active: true },
      { appId: 'app_ios', keywordId: 'kw_ios_us', active: true },
      { appId: 'app_ios', keywordId: 'kw_ios_us_alt', active: false },
      { appId: 'app_play', keywordId: 'kw_play_us', active: true },
      { appId: 'app_rival', keywordId: 'kw_ios_us', active: true },
    ]);
  });

  it('leaves app store snapshots without a short description untouched', async () => {
    const summaries = await prisma.appSnapshot.findMany({
      where: { app: { store: 'APP_STORE' } },
      select: { summary: true },
    });

    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries.every((row) => row.summary === null)).toBe(true);
  });
});
