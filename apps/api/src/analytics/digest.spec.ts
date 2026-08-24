import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DigestService } from './digest.service';

describe('DigestService.buildDigest', () => {
  let service: DigestService;
  const appFindMany = jest.fn();
  const rankingFindFirst = jest.fn();
  const trackedFindMany = jest.fn();
  const changeEventCount = jest.fn<
    Promise<number>,
    [Record<string, unknown>]
  >();
  const reviewCount = jest.fn<Promise<number>, [Record<string, unknown>]>();
  const auditScoreFindFirst = jest.fn();
  const actionGroupBy = jest.fn();

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:00:00Z'));
    appFindMany.mockReset();
    rankingFindFirst.mockReset();
    trackedFindMany.mockReset();
    changeEventCount.mockReset();
    reviewCount.mockReset();
    auditScoreFindFirst.mockReset();
    auditScoreFindFirst.mockResolvedValue(null);
    actionGroupBy.mockReset();
    actionGroupBy.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DigestService,
        {
          provide: PrismaService,
          useValue: {
            app: { findMany: appFindMany },
            keywordRanking: { findFirst: rankingFindFirst },
            trackedKeyword: { findMany: trackedFindMany },
            changeEvent: { count: changeEventCount },
            review: { count: reviewCount },
            auditScore: { findFirst: auditScoreFindFirst },
            actionItem: { groupBy: actionGroupBy },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(DigestService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('composes one summary per primary app over a UTC-day inclusive 7-day window', async () => {
    const reference = new Date('2026-07-13T00:00:00Z');
    appFindMany.mockResolvedValue([
      {
        id: 'app_1',
        name: 'Mine',
        groupId: null,
        group: null,
        competitors: [{ id: 'comp_1' }],
      },
    ]);
    rankingFindFirst.mockResolvedValue({ date: reference });
    trackedFindMany.mockResolvedValue([
      {
        keywordId: 'k1',
        source: 'TITLE',
        relevance: null,
        keyword: {
          text: 'kw',
          metrics: [{ traffic: 10, difficulty: 10, date: reference }],
          rankings: [
            { position: 20, date: new Date('2026-07-06T00:00:00Z') },
            { position: 4, date: reference },
          ],
        },
      },
    ]);
    changeEventCount.mockResolvedValue(3);
    reviewCount.mockResolvedValue(2);
    auditScoreFindFirst
      .mockResolvedValueOnce({
        date: new Date('2026-07-13T00:00:00Z'),
        overall: 78,
      })
      .mockResolvedValueOnce({
        date: new Date('2026-07-06T00:00:00Z'),
        overall: 75,
      });

    const payload = await service.buildDigest(2);

    expect(payload.event).toBe('digest.weekly');
    expect(payload.occurredAt).toBe('2026-07-13T09:00:00.000Z');
    expect(payload.window).toEqual({ from: '2026-07-06', to: '2026-07-13' });
    expect(payload.apps).toHaveLength(1);

    const [entry] = payload.apps;
    expect(entry).toMatchObject({
      id: 'app_1',
      name: 'Mine',
      changes: 3,
      negativeReviews: 2,
      audit: { current: 78, delta7d: 3 },
    });
    expect(entry.moversUp[0]).toMatchObject({ text: 'kw', from: 20, to: 4 });
    expect(entry.moversDown).toEqual([]);

    const changeArgs = changeEventCount.mock.calls[0][0] as {
      where: {
        appId: { in: string[] };
        capturedAt: { gte: Date; lt: Date };
      };
    };
    expect(changeArgs.where.appId.in).toEqual(['app_1', 'comp_1']);
    expect(changeArgs.where.capturedAt.gte.toISOString()).toBe(
      '2026-07-06T00:00:00.000Z',
    );
    expect(changeArgs.where.capturedAt.lt.toISOString()).toBe(
      '2026-07-14T00:00:00.000Z',
    );

    const reviewArgs = reviewCount.mock.calls[0][0] as {
      where: { appId: string; score: { lte: number } };
    };
    expect(reviewArgs.where.appId).toBe('app_1');
    expect(reviewArgs.where.score.lte).toBe(2);
  });

  it('reports a null delta when the only snapshot predates the 7-day baseline', async () => {
    appFindMany.mockResolvedValue([
      {
        id: 'app_1',
        name: 'Mine',
        groupId: null,
        group: null,
        competitors: [],
      },
    ]);
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    changeEventCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);
    const stale = { date: new Date('2026-07-01T00:00:00Z'), overall: 70 };
    auditScoreFindFirst
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(stale);

    const payload = await service.buildDigest(2);

    expect(payload.apps[0].audit).toEqual({ current: 70, delta7d: null });
  });

  it('summarizes linked apps as one blended group', async () => {
    const reference = new Date('2026-07-13T00:00:00Z');
    appFindMany.mockResolvedValue([
      {
        id: 'ios',
        name: 'Mine iOS',
        groupId: 'grp_1',
        group: { name: 'Habit' },
        competitors: [],
      },
      {
        id: 'android',
        name: 'Mine Play',
        groupId: 'grp_1',
        group: { name: 'Habit' },
        competitors: [],
      },
    ]);
    rankingFindFirst.mockResolvedValue({ date: reference });
    trackedFindMany.mockImplementation((args: { where: { appId: string } }) => [
      {
        keywordId: `k_${args.where.appId}`,
        source: 'TITLE',
        relevance: null,
        keyword: {
          text: 'kw',
          metrics: [
            {
              traffic: args.where.appId === 'ios' ? 10 : 5,
              difficulty: 10,
              date: reference,
            },
          ],
          rankings: [
            {
              position: args.where.appId === 'ios' ? 1 : 3,
              date: reference,
            },
          ],
        },
      },
    ]);
    changeEventCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);

    const payload = await service.buildDigest(2);

    expect(payload.groups).toEqual([
      {
        id: 'grp_1',
        name: 'Habit',
        visibility: { current: 83.3, delta7d: null },
      },
    ]);
  });

  it('reports no groups when nothing is linked', async () => {
    appFindMany.mockResolvedValue([
      {
        id: 'app_1',
        name: 'Mine',
        groupId: null,
        group: null,
        competitors: [],
      },
    ]);
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    changeEventCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);

    const payload = await service.buildDigest(2);
    expect(payload.groups).toEqual([]);
    expect(payload.apps[0].audit).toBeNull();
  });

  it('caps movers at three per direction', async () => {
    const reference = new Date('2026-07-13T00:00:00Z');
    const past = new Date('2026-07-06T00:00:00Z');
    appFindMany.mockResolvedValue([
      {
        id: 'app_1',
        name: 'Mine',
        groupId: null,
        group: null,
        competitors: [],
      },
    ]);
    rankingFindFirst.mockResolvedValue({ date: reference });
    trackedFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        keywordId: `k${i}`,
        source: 'TITLE',
        relevance: null,
        keyword: {
          text: `kw${i}`,
          metrics: [{ traffic: 10, difficulty: 10, date: reference }],
          rankings: [
            { position: 50 - i, date: past },
            { position: 5, date: reference },
          ],
        },
      })),
    );
    changeEventCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);

    const payload = await service.buildDigest(2);

    expect(payload.apps[0].moversUp).toHaveLength(3);
  });

  it('reports open action counts by priority per app', async () => {
    appFindMany.mockResolvedValue([
      {
        id: 'app_1',
        name: 'Mine',
        groupId: null,
        group: null,
        competitors: [],
      },
    ]);
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    changeEventCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);
    actionGroupBy.mockResolvedValue([
      { appId: 'app_1', priority: 'critical', _count: { _all: 2 } },
      { appId: 'app_1', priority: 'high', _count: { _all: 3 } },
      { appId: 'app_1', priority: 'low', _count: { _all: 1 } },
    ]);

    const digest = await service.buildDigest(2);

    expect(digest.apps[0].actions).toEqual({
      open: 6,
      critical: 2,
      high: 3,
    });
  });

  it('reports zeroes for an app with nothing to do', async () => {
    appFindMany.mockResolvedValue([
      {
        id: 'app_1',
        name: 'Mine',
        groupId: null,
        group: null,
        competitors: [],
      },
    ]);
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    changeEventCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);

    const digest = await service.buildDigest(2);

    expect(digest.apps[0].actions).toEqual({ open: 0, critical: 0, high: 0 });
  });

  it('reports null rather than zero when the count query fails', async () => {
    appFindMany.mockResolvedValue([
      {
        id: 'app_1',
        name: 'Mine',
        groupId: null,
        group: null,
        competitors: [],
      },
    ]);
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    changeEventCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);
    actionGroupBy.mockRejectedValue(new Error('table missing'));

    const digest = await service.buildDigest(2);

    expect(digest.apps[0].actions).toBeNull();
  });
});
