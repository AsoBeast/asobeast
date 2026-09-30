import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioInsightsService } from './portfolio-insights.service';
import {
  EMPTY_ACTION_COUNTS,
  PortfolioSignals,
} from './portfolio-signals.service';

describe('PortfolioInsightsService.insights', () => {
  let service: PortfolioInsightsService;
  const appFindMany = jest.fn();
  const rankingFindFirst = jest.fn();
  const trackedFindMany = jest.fn();
  const snapshotFindMany = jest.fn();
  const changeFindMany = jest.fn();
  const reviewGroupBy = jest.fn();
  const actionCounts = jest.fn();
  const auditTrend = jest.fn();

  const primary = (id: string, competitors: string[] = []) => ({
    id,
    name: id,
    competitors: competitors.map((competitor) => ({ id: competitor })),
    snapshots: [],
  });

  beforeEach(async () => {
    for (const mock of [
      appFindMany,
      rankingFindFirst,
      trackedFindMany,
      snapshotFindMany,
      changeFindMany,
      reviewGroupBy,
      actionCounts,
      auditTrend,
    ]) {
      mock.mockReset();
    }
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    snapshotFindMany.mockResolvedValue([]);
    changeFindMany.mockResolvedValue([]);
    reviewGroupBy.mockResolvedValue([]);
    actionCounts.mockResolvedValue(new Map());
    auditTrend.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PortfolioInsightsService,
        {
          provide: PrismaService,
          useValue: {
            app: { findMany: appFindMany },
            keywordRanking: { findFirst: rankingFindFirst },
            trackedKeyword: { findMany: trackedFindMany },
            appSnapshot: { findMany: snapshotFindMany },
            changeEvent: { findMany: changeFindMany },
            review: { groupBy: reviewGroupBy },
          },
        },
        { provide: PortfolioSignals, useValue: { actionCounts, auditTrend } },
        { provide: ConfigService, useValue: { get: () => 2 } },
      ],
    }).compile();
    service = moduleRef.get(PortfolioInsightsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports zeros and empty trends for an app with no data', async () => {
    appFindMany.mockResolvedValue([primary('app_1')]);

    const result = await service.insights();

    expect(result.apps).toEqual([
      {
        appId: 'app_1',
        rankDistribution: {
          top1: 0,
          top3: 0,
          top10: 0,
          top50: 0,
          beyond: 0,
          unranked: 0,
        },
        top10Delta7d: null,
        movement: { up: 0, down: 0, entered: 0, lost: 0 },
        rating: { average: null, count: null, averageDelta7d: null },
        audit: null,
        actions: EMPTY_ACTION_COUNTS,
        changes7d: { own: 0, competitors: 0 },
        negativeReviews7d: 0,
      },
    ]);
    expect(result.movers).toEqual({ up: [], down: [] });
    expect(result.totals.top10Delta7d).toBeNull();
  });

  it('attributes competitor changes to their primary app, one per day', async () => {
    appFindMany.mockResolvedValue([
      primary('app_1', ['rival_1', 'rival_2']),
      primary('app_2'),
    ]);
    const day = (offset: number) =>
      new Date(Date.UTC(2026, 8, 20 + offset, 12));
    changeFindMany.mockResolvedValue([
      { appId: 'app_1', capturedAt: day(0) },
      { appId: 'app_1', capturedAt: day(0) },
      { appId: 'rival_1', capturedAt: day(1) },
      { appId: 'rival_1', capturedAt: day(1) },
      { appId: 'rival_2', capturedAt: day(1) },
      { appId: 'rival_2', capturedAt: day(2) },
      { appId: 'app_2', capturedAt: day(0) },
      { appId: 'app_2', capturedAt: day(1) },
      { appId: 'app_2', capturedAt: day(2) },
      { appId: 'app_2', capturedAt: day(3) },
    ]);

    const result = await service.insights();
    const changes = new Map(
      result.apps.map((app) => [app.appId, app.changes7d]),
    );

    expect(changes.get('app_1')).toEqual({ own: 1, competitors: 3 });
    expect(changes.get('app_2')).toEqual({ own: 4, competitors: 0 });
    expect(result.totals.changes7d).toEqual({ own: 5, competitors: 3 });
  });

  it('reports no action counts when the count query fails', async () => {
    appFindMany.mockResolvedValue([primary('app_1'), primary('app_2')]);
    actionCounts.mockResolvedValue(null);

    const result = await service.insights();

    expect(result.apps.map((app) => app.actions)).toEqual([null, null]);
  });

  it('counts negative reviews by when they were written, not when they were stored', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-29T12:00:00Z'));
    appFindMany.mockResolvedValue([primary('app_1', ['rival_1'])]);
    reviewGroupBy.mockResolvedValue([{ appId: 'app_1', _count: { _all: 4 } }]);

    const result = await service.insights();

    const since = new Date('2026-09-22T12:00:00Z');
    expect(result.apps[0].negativeReviews7d).toBe(4);
    expect(reviewGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: { in: ['app_1'] },
          score: { lte: 2 },
          OR: [
            { reviewedAt: { gte: since } },
            { reviewedAt: null, createdAt: { gte: since } },
          ],
        },
      }),
    );
  });
});
