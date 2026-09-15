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

  it('leaves app store snapshots without a short description untouched', async () => {
    const summaries = await prisma.appSnapshot.findMany({
      where: { app: { store: 'APP_STORE' } },
      select: { summary: true },
    });

    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries.every((row) => row.summary === null)).toBe(true);
  });
});
