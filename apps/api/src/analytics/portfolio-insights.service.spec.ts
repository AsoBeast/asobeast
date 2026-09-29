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
  const changeGroupBy = jest.fn();
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
      changeGroupBy,
      reviewGroupBy,
      actionCounts,
      auditTrend,
    ]) {
      mock.mockReset();
    }
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    snapshotFindMany.mockResolvedValue([]);
    changeGroupBy.mockResolvedValue([]);
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
            changeEvent: { groupBy: changeGroupBy },
            review: { groupBy: reviewGroupBy },
          },
        },
        { provide: PortfolioSignals, useValue: { actionCounts, auditTrend } },
        { provide: ConfigService, useValue: { get: () => 2 } },
      ],
    }).compile();
    service = moduleRef.get(PortfolioInsightsService);
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

  it('attributes competitor changes to their primary app', async () => {
    appFindMany.mockResolvedValue([
      primary('app_1', ['rival_1', 'rival_2']),
      primary('app_2'),
    ]);
    changeGroupBy.mockResolvedValue([
      { appId: 'app_1', _count: { _all: 1 } },
      { appId: 'rival_1', _count: { _all: 2 } },
      { appId: 'rival_2', _count: { _all: 3 } },
      { appId: 'app_2', _count: { _all: 4 } },
    ]);

    const result = await service.insights();
    const changes = new Map(
      result.apps.map((app) => [app.appId, app.changes7d]),
    );

    expect(changes.get('app_1')).toEqual({ own: 1, competitors: 5 });
    expect(changes.get('app_2')).toEqual({ own: 4, competitors: 0 });
    expect(result.totals.changes7d).toEqual({ own: 5, competitors: 5 });
  });

  it('reports no action counts when the count query fails', async () => {
    appFindMany.mockResolvedValue([primary('app_1'), primary('app_2')]);
    actionCounts.mockResolvedValue(null);

    const result = await service.insights();

    expect(result.apps.map((app) => app.actions)).toEqual([null, null]);
  });
});
