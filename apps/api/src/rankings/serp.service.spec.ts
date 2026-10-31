import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { TrackedKeywordAccess } from '../keywords/tracked-keyword.access';
import { PrismaService } from '../prisma/prisma.service';
import { SerpService } from './serp.service';

interface StoredRow {
  position: number;
  storeAppId: string;
  title: string;
  developer?: string | null;
  iconUrl?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
}

interface SerpWhere {
  keywordId: string;
  position?: number;
  date?: Date | { lt: Date };
}

const isDay = (date: SerpWhere['date']): date is Date => date instanceof Date;

const LATEST = '2026-07-01';

const row = (position: number, storeAppId: string, title = storeAppId) => ({
  position,
  storeAppId,
  title,
  developer: null,
  iconUrl: null,
  ratingAvg: null,
  ratingCount: null,
});

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

describe('SerpService.serp', () => {
  const setup = (options?: {
    keyword?: unknown;
    days?: Record<string, StoredRow[]>;
    apps?: unknown[];
  }) => {
    const keyword =
      options && 'keyword' in options
        ? options.keyword
        : {
            id: 'kw1',
            text: 'habit tracker',
            store: Store.APP_STORE,
            country: 'us',
          };
    const requireKeyword = jest.fn((keywordId: string) =>
      keyword
        ? Promise.resolve(keyword)
        : Promise.reject(
            new NotFoundException(`Keyword ${keywordId} not found`),
          ),
    );
    const trackedKeywords = {
      require: requireKeyword,
    } as unknown as TrackedKeywordAccess;
    const days = options?.days ?? { [LATEST]: [] };
    const captured = Object.keys(days)
      .filter((day) => days[day].length > 0)
      .sort()
      .reverse()
      .map((day) => ({ date: new Date(`${day}T00:00:00.000Z`) }));
    const findMany = jest
      .fn<Promise<unknown[]>, [{ where: SerpWhere; take?: number }]>()
      .mockImplementation(({ where, take }) => {
        if (where.position === 1) {
          return Promise.resolve(captured.slice(0, take));
        }
        return Promise.resolve(
          isDay(where.date) ? (days[dayKey(where.date)] ?? []) : [],
        );
      });
    const findFirst = jest
      .fn<Promise<unknown>, [{ where: SerpWhere }]>()
      .mockImplementation(({ where }) => {
        const before = where.date && !isDay(where.date) ? where.date.lt : null;
        return Promise.resolve(
          captured.find((day) => before !== null && day.date < before) ?? null,
        );
      });
    const appFindMany = jest.fn().mockResolvedValue(options?.apps ?? []);
    const prisma = {
      serpEntry: { findMany, findFirst },
      app: { findMany: appFindMany },
    };
    const service = new SerpService(
      prisma as unknown as PrismaService,
      trackedKeywords,
    );
    const daysRead = () =>
      findMany.mock.calls
        .map(([query]) => query.where)
        .filter((where) => isDay(where.date))
        .map((where) => dayKey(where.date as Date));
    return { service, findMany, appFindMany, requireKeyword, daysRead };
  };

  it('throws when the caller does not track the keyword', async () => {
    const { service } = setup({ keyword: null });
    await expect(service.serp('missing', {})).rejects.toThrow(
      'Keyword missing not found',
    );
  });

  it('authorizes the keyword before reading any serp entry', async () => {
    const { service, findMany, requireKeyword } = setup();
    await service.serp('kw1', {});
    expect(requireKeyword).toHaveBeenCalledWith('kw1');
    expect(requireKeyword.mock.invocationCallOrder[0]).toBeLessThan(
      findMany.mock.invocationCallOrder[0],
    );
  });

  it('returns an empty snapshot with null date when never checked', async () => {
    const { service, findMany } = setup({ days: {} });
    const snapshot = await service.serp('kw1', {});
    expect(snapshot).toEqual({
      keywordId: 'kw1',
      text: 'habit tracker',
      date: null,
      entries: [],
      comparedTo: null,
      exits: [],
      dates: [],
    });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('reads the captured days newest first from the first position of each day', async () => {
    const { service, findMany } = setup({
      days: {
        '2026-06-29': [row(1, 'a')],
        [LATEST]: [row(1, 'a')],
        '2026-06-30': [row(1, 'a')],
      },
    });

    const snapshot = await service.serp('kw1', {});

    expect(findMany).toHaveBeenCalledWith({
      where: { keywordId: 'kw1', position: 1 },
      orderBy: { date: 'desc' },
      take: 365,
      select: { date: true },
    });
    expect(snapshot.dates).toEqual([LATEST, '2026-06-30', '2026-06-29']);
  });

  it('shows the newest day against the day before it', async () => {
    const { service, daysRead } = setup({
      days: {
        '2026-06-30': [row(1, 'b'), row(2, 'a'), row(3, 'gone')],
        [LATEST]: [row(1, 'a'), row(2, 'b'), row(3, 'new')],
      },
    });

    const snapshot = await service.serp('kw1', {});

    expect(snapshot.date).toBe(LATEST);
    expect(snapshot.comparedTo).toBe('2026-06-30');
    expect(daysRead().sort()).toEqual(['2026-06-30', LATEST]);
    expect(
      snapshot.entries.map(({ storeAppId, previous, delta, movement }) => ({
        storeAppId,
        previous,
        delta,
        movement,
      })),
    ).toEqual([
      { storeAppId: 'a', previous: 2, delta: -1, movement: 'up' },
      { storeAppId: 'b', previous: 1, delta: 1, movement: 'down' },
      { storeAppId: 'new', previous: null, delta: null, movement: 'new' },
    ]);
    expect(snapshot.exits).toEqual([
      {
        previous: 3,
        storeAppId: 'gone',
        title: 'gone',
        developer: null,
        iconUrl: null,
        appId: null,
        isCompetitor: false,
      },
    ]);
  });

  it('compares an asked day with the captured day before it', async () => {
    const { service } = setup({
      days: {
        [LATEST]: [row(1, 'a')],
        '2026-06-30': [row(1, 'a')],
        '2026-06-20': [row(1, 'a')],
        '2026-06-10': [row(1, 'a')],
      },
    });

    const snapshot = await service.serp('kw1', { date: '2026-06-20' });

    expect(snapshot.date).toBe('2026-06-20');
    expect(snapshot.comparedTo).toBe('2026-06-10');
  });

  it('compares a day older than the captured day list with the day before it', async () => {
    const days: Record<string, StoredRow[]> = {};
    for (let back = 0; back < 400; back += 1) {
      const day = new Date(Date.UTC(2026, 6, 1) - back * 86_400_000);
      days[dayKey(day)] = [row(1, 'a')];
    }
    const { service } = setup({ days });

    const snapshot = await service.serp('kw1', { date: '2025-06-01' });

    expect(snapshot.dates).toHaveLength(365);
    expect(snapshot.dates).not.toContain('2025-06-01');
    expect(snapshot.comparedTo).toBe('2025-05-31');
    expect(snapshot.entries[0]).toMatchObject({ movement: 'same' });
  });

  it('answers an empty day for an asked day that was not captured', async () => {
    const { service, daysRead } = setup({
      days: {
        [LATEST]: [row(1, 'a')],
        '2026-06-20': [row(1, 'a')],
      },
    });

    const snapshot = await service.serp('kw1', { date: '2026-06-25' });

    expect(snapshot).toMatchObject({
      date: '2026-06-25',
      entries: [],
      exits: [],
      comparedTo: null,
      dates: [LATEST, '2026-06-20'],
    });
    expect(daysRead()).toEqual(['2026-06-25']);
  });

  it('answers no movement on the first captured day', async () => {
    const { service } = setup({ days: { [LATEST]: [row(1, 'a')] } });

    const snapshot = await service.serp('kw1', {});

    expect(snapshot.comparedTo).toBeNull();
    expect(snapshot.exits).toEqual([]);
    expect(snapshot.entries[0]).toMatchObject({
      previous: null,
      delta: null,
      movement: 'none',
    });
  });

  it('annotates self, competitor and unknown apps', async () => {
    const { service } = setup({
      days: {
        [LATEST]: [
          {
            position: 1,
            storeAppId: 'self-store',
            title: 'You',
            developer: 'Me',
            ratingAvg: 4.5,
            ratingCount: 100,
          },
          {
            position: 2,
            storeAppId: 'rival-store',
            title: 'Rival',
            developer: 'Them',
            ratingAvg: 4,
            ratingCount: 50,
          },
          {
            position: 3,
            storeAppId: 'unknown-store',
            title: 'Stranger',
            developer: null,
            ratingAvg: null,
            ratingCount: null,
          },
        ],
      },
      apps: [
        { id: 'app1', storeAppId: 'self-store', isCompetitor: false },
        { id: 'app2', storeAppId: 'rival-store', isCompetitor: true },
      ],
    });

    const snapshot = await service.serp('kw1', {});

    expect(snapshot.date).toBe(LATEST);
    expect(snapshot.entries[0]).toMatchObject({
      appId: 'app1',
      isCompetitor: false,
    });
    expect(snapshot.entries[1]).toMatchObject({
      appId: 'app2',
      isCompetitor: true,
    });
    expect(snapshot.entries[2]).toMatchObject({
      appId: null,
      isCompetitor: false,
    });
  });

  it('annotates entries and exits through one lookup of every store app', async () => {
    const { service, appFindMany } = setup({
      days: {
        '2026-06-30': [row(1, 'rival-store'), row(2, 'self-store')],
        [LATEST]: [row(1, 'self-store'), row(2, 'other')],
      },
      apps: [
        { id: 'app1', storeAppId: 'self-store', isCompetitor: false },
        { id: 'app2', storeAppId: 'rival-store', isCompetitor: true },
      ],
    });

    const snapshot = await service.serp('kw1', {});

    expect(appFindMany).toHaveBeenCalledTimes(1);
    const [query] = appFindMany.mock.calls[0] as [
      { where: { storeAppId: { in: string[] } } },
    ];
    expect([...query.where.storeAppId.in].sort()).toEqual([
      'other',
      'rival-store',
      'self-store',
    ]);
    expect(snapshot.exits).toEqual([
      expect.objectContaining({
        storeAppId: 'rival-store',
        appId: 'app2',
        isCompetitor: true,
      }),
    ]);
  });

  it('answers the icon and how the title holds the keyword', async () => {
    const icon = 'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg';
    const { service, findMany } = setup({
      days: {
        [LATEST]: [
          { ...row(1, 'a', 'Habit Tracker Pro'), iconUrl: icon },
          row(2, 'b', 'Streaks'),
        ],
      },
    });

    const snapshot = await service.serp('kw1', {});

    expect(snapshot.entries[0]).toMatchObject({
      iconUrl: icon,
      titleMatch: 'phrase',
      titleSegments: [
        { text: 'Habit', match: 'exact' },
        { text: ' ', match: 'none' },
        { text: 'Tracker', match: 'exact' },
        { text: ' Pro', match: 'none' },
      ],
    });
    expect(snapshot.entries[1]).toMatchObject({
      iconUrl: null,
      titleMatch: 'none',
      titleSegments: [{ text: 'Streaks', match: 'none' }],
    });
    const shownDay = findMany.mock.calls.find(
      ([query]) => query.where.date !== undefined,
    ) as unknown as [{ select: Record<string, boolean> }];
    expect(shownDay[0].select.iconUrl).toBe(true);
  });
});
