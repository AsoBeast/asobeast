import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryPopularity } from './discovery-popularity.service';
import { DiscoveryTracker } from './discovery-tracker.service';
import { KeywordDiscoveryService } from './keyword-discovery.service';

const NOW = new Date('2026-11-11T12:00:00Z');

interface Metric {
  traffic: number | null;
  difficulty: number | null;
}

interface Row {
  keywordId: string;
  source: string;
  relevance: number;
  position: number | null;
  depth: number | null;
  checkedOn: Date | null;
  keyword: { text: string; country: string; metrics: Metric[] };
}

const row = (keywordId: string, overrides: Partial<Row> = {}): Row => ({
  keywordId,
  source: 'title',
  relevance: 70,
  position: null,
  depth: null,
  checkedOn: null,
  keyword: { text: keywordId, country: 'us', metrics: [] },
  ...overrides,
});

interface Fixture {
  store?: Store;
  isCompetitor?: boolean;
  rows?: Row[];
  queued?: { queuedAt: Date; checkedOn: Date | null; depth: number | null }[];
  newestCheck?: Date | null;
  listed?: Map<string, number>;
  cron?: string;
  autoTrackRanked?: boolean;
  unfit?: number;
}

const build = (fixture: Fixture = {}) => {
  const findMany = jest.fn((args: { where: { queuedAt?: unknown } }) =>
    Promise.resolve(
      args.where.queuedAt ? (fixture.queued ?? []) : (fixture.rows ?? []),
    ),
  );
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        workspaceId: 'ws',
        store: fixture.store ?? Store.APP_STORE,
        country: 'us',
        storeAppId: '42',
        isCompetitor: fixture.isCompetitor ?? false,
        autoTrackRanked: fixture.autoTrackRanked ?? false,
      }),
    },
    keywordDiscovery: {
      findMany,
      aggregate: jest.fn().mockResolvedValue({
        _max: { checkedOn: fixture.newestCheck ?? null },
      }),
    },
  };
  const popularity = {
    listedTraffic: jest.fn().mockResolvedValue(fixture.listed ?? new Map()),
  };
  const config = {
    get: jest.fn(() => fixture.cron ?? '30 7 * * 1'),
  };
  const tracker = { unfit: jest.fn().mockResolvedValue(fixture.unfit ?? 0) };
  const service = new KeywordDiscoveryService(
    prisma as unknown as PrismaService,
    popularity as unknown as DiscoveryPopularity,
    config as unknown as ConfigService<Env, true>,
    tracker as unknown as DiscoveryTracker,
  );
  return { service, prisma, popularity, findMany, tracker };
};

const ALL = { state: 'all' as const, limit: 200 };

describe('KeywordDiscoveryService.list', () => {
  it('reads only open rows of the app, scoped to the market asked for', async () => {
    const { service, findMany } = build();
    await service.list('app1', { ...ALL, country: 'de' }, NOW);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app1',
          dismissedAt: null,
          keyword: { tracked: { none: { appId: 'app1' } }, country: 'de' },
        },
      }),
    );
  });

  it('derives volume and opportunity from the newest score and the stored relevance', async () => {
    const { service } = build({
      rows: [
        row('study timer', {
          relevance: 80,
          keyword: {
            text: 'study timer',
            country: 'us',
            metrics: [{ traffic: 6, difficulty: 2 }],
          },
        }),
      ],
    });
    const { items } = await service.list('app1', ALL, NOW);
    expect(items[0]).toMatchObject({
      traffic: 6,
      difficulty: 2,
      relevance: 80,
      volume: 60,
      opportunity: 80,
      state: 'opportunity',
    });
  });

  it('shows the popularity Apple lists for an unscored App Store term', async () => {
    const { service, popularity } = build({
      rows: [row('time blocking')],
      listed: new Map([['time blocking', 7]]),
    });
    const { items } = await service.list('app1', ALL, NOW);
    expect(popularity.listedTraffic).toHaveBeenCalledWith('us', [
      'time blocking',
    ]);
    expect(items[0]).toMatchObject({
      traffic: 7,
      difficulty: null,
      opportunity: null,
    });
  });

  it('never reads Apple popularity for Google Play', async () => {
    const { service, popularity } = build({
      store: Store.GOOGLE_PLAY,
      rows: [row('time blocking')],
    });
    const { items } = await service.list('app1', ALL, NOW);
    expect(popularity.listedTraffic).not.toHaveBeenCalled();
    expect(items[0]?.traffic).toBeNull();
  });

  it('counts and recommends before the state filter and the limit apply', async () => {
    const { service } = build({
      rows: [
        row('ranked a', { position: 3, depth: 50, relevance: 90 }),
        row('ranked b', { position: 120, depth: 200, relevance: 80 }),
        row('open', { relevance: 60 }),
      ],
    });
    const ranked = await service.list(
      'app1',
      { state: 'ranked', limit: 1 },
      NOW,
    );
    expect(ranked.counts).toEqual({ all: 3, ranked: 2, opportunity: 0 });
    expect(ranked.items.map(({ text }) => text)).toEqual(['ranked a']);
    expect(ranked.items[0]?.recommended).toBe(true);
  });

  it('reports the ranked rows the plan has no room for only while auto track is on', async () => {
    const rows = [
      row('ranked', { position: 3, depth: 50 }),
      row('unranked', { depth: 200 }),
    ];
    const off = build({ rows, unfit: 1 });
    expect((await off.service.list('app1', ALL, NOW)).unfit).toBe(0);
    expect(off.tracker.unfit).not.toHaveBeenCalled();

    const on = build({ rows, autoTrackRanked: true, unfit: 1 });
    expect(await on.service.list('app1', ALL, NOW)).toMatchObject({
      autoTrackRanked: true,
      unfit: 1,
    });
    expect(on.tracker.unfit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      [expect.objectContaining({ keywordId: 'ranked', state: 'ranked' })],
    );
  });

  it('reports the weekly checks', async () => {
    const { service, findMany } = build({
      queued: [
        {
          queuedAt: new Date('2026-11-11T07:30:00Z'),
          checkedOn: null,
          depth: null,
        },
        {
          queuedAt: new Date('2026-11-09T07:30:00Z'),
          checkedOn: new Date('2026-11-09T00:00:00Z'),
          depth: 200,
        },
      ],
      newestCheck: new Date('2026-11-09T00:00:00Z'),
    });
    const { checks } = await service.list('app1', ALL, NOW);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        appId: 'app1',
        queuedAt: { gte: new Date('2026-11-09T00:00:00Z') },
      },
      select: { queuedAt: true, checkedOn: true, depth: true },
    });
    expect(checks).toEqual({
      perWeek: 40,
      usedThisWeek: 2,
      pending: 1,
      checkedAt: '2026-11-09',
      nextRunAt: '2026-11-16T07:30:00.000Z',
    });
  });

  it('keeps a check queued late on Sunday pending after Monday begins', async () => {
    const monday = new Date('2026-11-09T06:00:00Z');
    const { service, findMany } = build({
      queued: [
        {
          queuedAt: new Date('2026-11-08T22:00:00Z'),
          checkedOn: null,
          depth: null,
        },
        {
          queuedAt: new Date('2026-11-09T01:00:00Z'),
          checkedOn: null,
          depth: null,
        },
      ],
    });
    const { checks } = await service.list('app1', ALL, monday);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        appId: 'app1',
        queuedAt: { gte: new Date('2026-11-08T06:00:00Z') },
      },
      select: { queuedAt: true, checkedOn: true, depth: true },
    });
    expect(checks).toMatchObject({ usedThisWeek: 1, pending: 2 });
  });

  it('reads only the newest score of each keyword', async () => {
    const { service, findMany } = build();
    await service.list('app1', ALL, NOW);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          keyword: {
            select: {
              text: true,
              country: true,
              metrics: {
                orderBy: { date: 'desc' },
                take: 1,
                select: { traffic: true, difficulty: true },
              },
            },
          },
        }) as object,
      }),
    );
  });

  it('answers the next run of a schedule that names its weekday', async () => {
    const { service } = build({ cron: '30 7 * * MON' });
    const { checks } = await service.list('app1', ALL, NOW);
    expect(checks.nextRunAt).toBe('2026-11-16T07:30:00.000Z');
  });

  it('answers the next run of a schedule that runs on several days', async () => {
    const { service } = build({ cron: '30 7 * * MON,THU' });
    const { checks } = await service.list('app1', ALL, NOW);
    expect(checks.nextRunAt).toBe('2026-11-12T07:30:00.000Z');
  });

  it('answers the next run of a daily schedule', async () => {
    const { service } = build({ cron: '30 7 * * *' });
    const { checks } = await service.list('app1', ALL, NOW);
    expect(checks.nextRunAt).toBe('2026-11-12T07:30:00.000Z');
  });

  it('answers no next run while the schedule is off', async () => {
    const { service } = build({ cron: '', store: Store.GOOGLE_PLAY });
    const { checks } = await service.list('app1', ALL, NOW);
    expect(checks).toMatchObject({ perWeek: 20, nextRunAt: null });
  });

  it('refuses a competitor app', async () => {
    const { service } = build({ isCompetitor: true });
    await expect(service.list('app1', ALL, NOW)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
