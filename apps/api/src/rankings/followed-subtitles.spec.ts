import { PrismaService } from '../prisma/prisma.service';
import { followedSubtitles } from './followed-subtitles';

const setup = (rows: { appId: string; subtitle: string | null }[] = []) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { appSnapshot: { findMany } } as unknown as PrismaService;
  return { prisma, findMany };
};

describe('followedSubtitles', () => {
  it('asks for the newest snapshot of each app in the keyword market before the end of the day', async () => {
    const { prisma, findMany } = setup([
      { appId: 'home-app', subtitle: 'Habit tracker and planner' },
      { appId: 'away-app', subtitle: 'Tracker for streaks' },
    ]);

    const subtitles = await followedSubtitles(
      prisma,
      [
        { id: 'home-app', storeAppId: 'home-store', country: 'us' },
        { id: 'away-app', storeAppId: 'away-store', country: 'gb' },
      ],
      'us',
      '2026-07-01',
    );

    const before = new Date('2026-07-02T00:00:00.000Z');
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            appId: 'home-app',
            country: null,
            localization: null,
            capturedAt: { lt: before },
          },
          {
            appId: 'away-app',
            country: 'us',
            localization: null,
            capturedAt: { lt: before },
          },
        ],
      },
      orderBy: { capturedAt: 'desc' },
      distinct: ['appId'],
      select: { appId: true, subtitle: true },
    });
    expect([...subtitles]).toEqual([
      ['home-store', 'Habit tracker and planner'],
      ['away-store', 'Tracker for streaks'],
    ]);
  });

  it('answers nothing without apps', async () => {
    const { prisma, findMany } = setup();

    const subtitles = await followedSubtitles(prisma, [], 'us', '2026-07-01');

    expect(subtitles.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('answers a known empty subtitle as null', async () => {
    const { prisma } = setup([
      { appId: 'quiet-app', subtitle: null },
      { appId: 'blank-app', subtitle: '' },
    ]);

    const subtitles = await followedSubtitles(
      prisma,
      [
        { id: 'quiet-app', storeAppId: 'quiet-store', country: 'us' },
        { id: 'blank-app', storeAppId: 'blank-store', country: 'us' },
      ],
      'us',
      '2026-07-01',
    );

    expect(subtitles.get('quiet-store')).toBeNull();
    expect(subtitles.get('blank-store')).toBeNull();
    expect(subtitles.has('missing-store')).toBe(false);
  });

  it('answers the newest listing among the records of one store app', async () => {
    const { prisma } = setup([
      { appId: 'american-record', subtitle: 'Habit tracker und Planer' },
      { appId: 'german-record', subtitle: 'Gewohnheiten planen' },
    ]);

    const subtitles = await followedSubtitles(
      prisma,
      [
        { id: 'german-record', storeAppId: 'self-store', country: 'de' },
        { id: 'american-record', storeAppId: 'self-store', country: 'us' },
      ],
      'de',
      '2026-07-01',
    );

    expect([...subtitles]).toEqual([
      ['self-store', 'Habit tracker und Planer'],
    ]);
  });
});
