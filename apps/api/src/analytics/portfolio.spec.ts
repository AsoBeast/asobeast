import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from './portfolio.service';

describe('PortfolioService.portfolio', () => {
  let service: PortfolioService;
  const appFindMany = jest.fn();
  const rankingFindFirst = jest.fn();
  const trackedFindMany = jest.fn();
  const changeEventCount = jest.fn();

  beforeEach(async () => {
    appFindMany.mockReset();
    rankingFindFirst.mockReset();
    trackedFindMany.mockReset();
    changeEventCount.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: PrismaService,
          useValue: {
            app: { findMany: appFindMany },
            keywordRanking: { findFirst: rankingFindFirst },
            trackedKeyword: { findMany: trackedFindMany },
            changeEvent: { count: changeEventCount },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(PortfolioService);
  });

  it('yields zero current and empty sparkline for an app with no rankings', async () => {
    appFindMany.mockImplementation(
      (args: { where?: { isCompetitor?: boolean } }) =>
        args.where?.isCompetitor === false
          ? [
              {
                id: 'app_1',
                store: 'APP_STORE',
                country: 'us',
                name: 'Empty',
                iconUrl: null,
                groupId: null,
                group: null,
                _count: { competitors: 0 },
                snapshots: [],
              },
            ]
          : [{ id: 'app_1' }],
    );
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    changeEventCount.mockResolvedValue(0);

    const result = await service.portfolio();

    expect(result.apps).toEqual([
      {
        id: 'app_1',
        store: 'APP_STORE',
        country: 'us',
        name: 'Empty',
        iconUrl: null,
        groupId: null,
        groupName: null,
        visibility: { current: 0, delta7d: null },
        sparkline: [],
        trackedKeywords: 0,
        competitors: 0,
        lastCapturedAt: null,
      },
    ]);
    expect(result.groups).toEqual([]);
    expect(result.totals).toEqual({
      apps: 1,
      competitors: 0,
      trackedKeywords: 0,
      changes7d: 0,
    });
  });

  it('orders apps by current visibility then name and totals across the workspace', async () => {
    const reference = new Date('2026-07-13T00:00:00Z');
    appFindMany.mockImplementation(
      (args: { where?: { isCompetitor?: boolean } }) =>
        args.where?.isCompetitor === false
          ? [
              {
                id: 'low',
                store: 'APP_STORE',
                country: 'us',
                name: 'Low',
                iconUrl: null,
                groupId: null,
                group: null,
                _count: { competitors: 1 },
                snapshots: [{ capturedAt: reference }],
              },
              {
                id: 'high',
                store: 'APP_STORE',
                country: 'us',
                name: 'High',
                iconUrl: null,
                groupId: null,
                group: null,
                _count: { competitors: 2 },
                snapshots: [{ capturedAt: reference }],
              },
            ]
          : [{ id: 'low' }, { id: 'high' }],
    );
    rankingFindFirst.mockResolvedValue({ date: reference });
    trackedFindMany.mockImplementation((args: { where: { appId: string } }) => {
      const position = args.where.appId === 'high' ? 1 : 50;
      return [
        {
          keywordId: 'k1',
          source: 'TITLE',
          relevance: null,
          keyword: {
            text: 'kw',
            metrics: [{ traffic: 10, difficulty: 10, date: reference }],
            rankings: [{ position, date: reference }],
          },
        },
      ];
    });
    changeEventCount.mockResolvedValue(4);

    const result = await service.portfolio();

    expect(result.apps.map((app) => app.id)).toEqual(['high', 'low']);
    expect(result.apps[0].visibility.current).toBeGreaterThan(
      result.apps[1].visibility.current,
    );
    expect(result.apps[0].sparkline).toEqual([
      { date: '2026-07-13', visibility: result.apps[0].visibility.current },
    ]);
    expect(result.groups).toEqual([]);
    expect(result.totals).toEqual({
      apps: 2,
      competitors: 3,
      trackedKeywords: 2,
      changes7d: 4,
    });
  });

  it('blends group visibility over the union of member keywords', async () => {
    const reference = new Date('2026-07-13T00:00:00Z');
    appFindMany.mockImplementation(
      (args: { where?: { isCompetitor?: boolean } }) =>
        args.where?.isCompetitor === false
          ? [
              linkedApp('ios', 'Habit iOS'),
              linkedApp('android', 'Habit Android'),
            ]
          : [{ id: 'ios' }, { id: 'android' }],
    );
    rankingFindFirst.mockResolvedValue({ date: reference });
    trackedFindMany.mockImplementation((args: { where: { appId: string } }) =>
      args.where.appId === 'ios'
        ? [row('k_ios', 10, 1, reference)]
        : [row('k_android', 5, 3, reference)],
    );
    changeEventCount.mockResolvedValue(0);

    const result = await service.portfolio();

    expect(result.groups).toHaveLength(1);
    const [group] = result.groups;
    expect(group.id).toBe('grp_1');
    expect(group.name).toBe('Habit');
    expect(group.memberAppIds).toEqual(['ios', 'android']);
    expect(group.visibility.current).toBeCloseTo(83.3, 1);
    expect(group.visibility.delta7d).toBeNull();
    expect(group.sparkline).toEqual([
      { date: '2026-07-13', visibility: group.visibility.current },
    ]);
  });

  it('degrades a group to its only scored member', async () => {
    const reference = new Date('2026-07-13T00:00:00Z');
    appFindMany.mockImplementation(
      (args: { where?: { isCompetitor?: boolean } }) =>
        args.where?.isCompetitor === false
          ? [linkedApp('ios', 'Habit iOS'), linkedApp('android', 'Habit Play')]
          : [{ id: 'ios' }, { id: 'android' }],
    );
    rankingFindFirst.mockImplementation((args: { where: { appId: string } }) =>
      args.where.appId === 'ios' ? { date: reference } : null,
    );
    trackedFindMany.mockImplementation((args: { where: { appId: string } }) =>
      args.where.appId === 'ios' ? [row('k_ios', 10, 1, reference)] : [],
    );
    changeEventCount.mockResolvedValue(0);

    const result = await service.portfolio();

    const ios = result.apps.find((app) => app.id === 'ios')!;
    expect(result.groups[0].visibility.current).toBe(ios.visibility.current);
    expect(result.groups[0].memberAppIds).toEqual(['ios', 'android']);
  });
});

const linkedApp = (id: string, name: string) => ({
  id,
  store: 'APP_STORE',
  country: 'us',
  name,
  iconUrl: null,
  groupId: 'grp_1',
  group: { name: 'Habit' },
  _count: { competitors: 0 },
  snapshots: [],
});

const row = (
  keywordId: string,
  traffic: number,
  position: number,
  date: Date,
) => ({
  keywordId,
  source: 'MANUAL',
  relevance: null,
  keyword: {
    text: keywordId,
    metrics: [{ traffic, difficulty: 10, date }],
    rankings: [{ position, date }],
  },
});
