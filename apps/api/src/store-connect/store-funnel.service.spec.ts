import { randomBytes } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { SecretBox } from '../common/crypto/secret-box';
import type { PrismaService } from '../prisma/prisma.service';
import { StoreFunnelService } from './store-funnel.service';

const NOW = new Date('2026-10-16T12:00:00.000Z');
const NOVEMBER_NOW = new Date('2026-11-10T12:00:00.000Z');

type AggregateArgs = {
  where?: { territory?: string; date?: { lt?: Date } };
};

const aggregateFor = (latest: Date, earlier: Date | null) =>
  jest.fn((args: AggregateArgs) =>
    Promise.resolve(
      args.where?.territory === 'all' && args.where.date?.lt
        ? { _max: { date: earlier } }
        : args.where?.territory === 'all'
          ? { _max: { date: latest } }
          : { _min: { date: null }, _max: { date: null } },
    ),
  );

interface Setup {
  app: { id: string; store: string; isCompetitor: boolean } | null;
  request: { id: string } | null;
  box: SecretBox | null;
}

function build(overrides: Partial<Setup> = {}) {
  const { app, request, box }: Setup = {
    app: { id: 'app_1', store: 'APP_STORE', isCompetitor: false },
    request: { id: 'req_1' },
    box: new SecretBox(randomBytes(32)),
    ...overrides,
  };
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(app) },
    storeReportRequest: {
      findMany: jest
        .fn()
        .mockResolvedValue(request ? [{ appId: 'app_1' }] : []),
    },
    storeFunnelPageDay: { findMany: jest.fn().mockResolvedValue([]) },
    storeFunnelDay: {
      groupBy: jest.fn().mockResolvedValue([
        {
          date: new Date('2026-10-10T00:00:00.000Z'),
          sourceType: 'search',
          pageType: 'productPage',
          _sum: {
            impressions: 10,
            uniqueImpressions: 10,
            pageViews: 4,
            uniquePageViews: 4,
            gets: 1,
            uniqueGets: 1,
          },
        },
      ]),
      aggregate: jest.fn((args: { where?: { territory?: string } }) =>
        Promise.resolve(
          args.where?.territory === 'all'
            ? { _max: { date: new Date('2026-09-15T00:00:00.000Z') } }
            : {
                _min: { date: new Date('2026-08-01T00:00:00.000Z') },
                _max: { date: new Date('2026-10-15T00:00:00.000Z') },
              },
        ),
      ),
    },
    storeFunnelSearchTerm: { count: jest.fn().mockResolvedValue(0) },
  };
  const service = new StoreFunnelService(
    prisma as unknown as PrismaService,
    box,
  );
  return { service, prisma };
}

describe('StoreFunnelService', () => {
  it('answers connected false with empty series for a competitor', async () => {
    const { service, prisma } = build({
      app: { id: 'app_1', store: 'APP_STORE', isCompetitor: true },
    });

    await expect(service.report('app_1', { days: 90 }, NOW)).resolves.toEqual({
      appId: 'app_1',
      store: 'APP_STORE',
      country: null,
      connected: false,
      source: null,
      days: 90,
      completeThrough: null,
      points: [],
      windows: [],
    });
    expect(prisma.storeFunnelDay.groupBy).not.toHaveBeenCalled();
  });

  it('answers connected false when no active request reports the app', async () => {
    const { service } = build({ request: null });

    const report = await service.report('app_1', { days: 90 }, NOW);

    expect(report.connected).toBe(false);
    expect(report.points).toEqual([]);
  });

  it('answers connected false while store connections are off', async () => {
    const { service, prisma } = build({ box: null });

    const report = await service.report('app_1', { days: 90 }, NOW);

    expect(report.connected).toBe(false);
    expect(prisma.storeReportRequest.findMany).not.toHaveBeenCalled();
  });

  it('asks only for an ongoing request in the requested state of an active connection', async () => {
    const { service, prisma } = build();

    await service.report('app_1', { days: 90 }, NOW);

    expect(prisma.storeReportRequest.findMany).toHaveBeenCalledWith({
      where: {
        appId: { in: ['app_1'] },
        accessType: 'ONGOING',
        state: 'requested',
        connection: { status: 'active', store: 'APP_STORE' },
      },
      select: { appId: true },
    });
  });

  it('reads only the rows of the range the series and windows need, in the market asked for', async () => {
    const { service, prisma } = build();

    const report = await service.report(
      'app_1',
      { days: 90, country: 'de' },
      NOW,
    );

    expect(prisma.storeFunnelDay.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['date', 'sourceType', 'pageType'],
        where: {
          appId: 'app_1',
          date: { gte: new Date('2026-07-19T00:00:00.000Z') },
          country: 'de',
        },
      }),
    );
    expect(report).toMatchObject({
      connected: true,
      source: 'appStoreConnect',
      country: 'de',
      completeThrough: '2026-10-13',
    });
    expect(report.points).toHaveLength(90);
    expect(report.windows.map((window) => window.status)).toEqual([
      'measured',
      'measured',
      'measured',
    ]);
  });

  it('names the newest imported month when its play report named no search terms', async () => {
    const { service, prisma } = build({
      app: { id: 'app_1', store: 'GOOGLE_PLAY', isCompetitor: false },
    });

    const report = await service.report('app_1', { days: 90 }, NOW);

    expect(prisma.storeFunnelDay.aggregate).toHaveBeenCalledWith({
      where: { appId: 'app_1', territory: 'all' },
      _max: { date: true },
    });
    expect(prisma.storeFunnelSearchTerm.count).toHaveBeenCalledWith({
      where: { appId: 'app_1', month: new Date('2026-09-01T00:00:00.000Z') },
    });
    expect(report.noSearchTermsMonth).toBe('2026-09-01');
  });

  it('leaves the month out when the newest imported month named a term', async () => {
    const { service, prisma } = build({
      app: { id: 'app_1', store: 'GOOGLE_PLAY', isCompetitor: false },
    });
    prisma.storeFunnelSearchTerm.count.mockResolvedValue(3);

    const report = await service.report('app_1', { days: 90 }, NOW);

    expect(report.noSearchTermsMonth).toBeUndefined();
  });

  it('leaves the month out when no traffic file was imported at all', async () => {
    const { service, prisma } = build({
      app: { id: 'app_1', store: 'GOOGLE_PLAY', isCompetitor: false },
    });
    prisma.storeFunnelDay.aggregate.mockResolvedValue({
      _min: { date: null },
      _max: { date: null },
    });

    const report = await service.report('app_1', { days: 90 }, NOW);

    expect(report.noSearchTermsMonth).toBeUndefined();
    expect(prisma.storeFunnelSearchTerm.count).not.toHaveBeenCalled();
  });

  it('skips the month in progress when the newest complete month named a term', async () => {
    const { service, prisma } = build({
      app: { id: 'app_1', store: 'GOOGLE_PLAY', isCompetitor: false },
    });
    prisma.storeFunnelDay.aggregate = aggregateFor(
      new Date('2026-11-09T00:00:00.000Z'),
      new Date('2026-10-31T00:00:00.000Z'),
    );
    prisma.storeFunnelSearchTerm.count.mockImplementation(
      ({ where: { month } }: { where: { month: Date } }) =>
        Promise.resolve(
          month.getTime() === new Date('2026-10-01T00:00:00.000Z').getTime()
            ? 1
            : 0,
        ),
    );

    const report = await service.report('app_1', { days: 90 }, NOVEMBER_NOW);

    expect(report.noSearchTermsMonth).toBeUndefined();
    expect(prisma.storeFunnelSearchTerm.count).toHaveBeenCalledWith({
      where: { appId: 'app_1', month: new Date('2026-10-01T00:00:00.000Z') },
    });
  });

  it('names the month in progress when it is the only month imported', async () => {
    const { service, prisma } = build({
      app: { id: 'app_1', store: 'GOOGLE_PLAY', isCompetitor: false },
    });
    prisma.storeFunnelDay.aggregate = aggregateFor(
      new Date('2026-11-05T00:00:00.000Z'),
      null,
    );

    const report = await service.report('app_1', { days: 90 }, NOVEMBER_NOW);

    expect(report.noSearchTermsMonth).toBe('2026-11-01');
    expect(prisma.storeFunnelSearchTerm.count).toHaveBeenCalledWith({
      where: { appId: 'app_1', month: new Date('2026-11-01T00:00:00.000Z') },
    });
  });

  it('names the newest complete month when the month in progress has traffic rows', async () => {
    const { service, prisma } = build({
      app: { id: 'app_1', store: 'GOOGLE_PLAY', isCompetitor: false },
    });
    prisma.storeFunnelDay.aggregate = aggregateFor(
      new Date('2026-11-09T00:00:00.000Z'),
      new Date('2026-10-20T00:00:00.000Z'),
    );

    const report = await service.report('app_1', { days: 90 }, NOVEMBER_NOW);

    expect(prisma.storeFunnelDay.aggregate).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        territory: 'all',
        date: { lt: new Date('2026-11-01T00:00:00.000Z') },
      },
      _max: { date: true },
    });
    expect(report.noSearchTermsMonth).toBe('2026-10-01');
  });

  it('throws 404 for an unknown app', async () => {
    const { service } = build({ app: null });

    await expect(
      service.report('nope', { days: 90 }, NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
