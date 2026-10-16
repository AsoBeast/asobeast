import { randomBytes } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { SecretBox } from '../common/crypto/secret-box';
import type { PrismaService } from '../prisma/prisma.service';
import { StoreFunnelService } from './store-funnel.service';

const NOW = new Date('2026-10-16T12:00:00.000Z');

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
    storeReportRequest: { findFirst: jest.fn().mockResolvedValue(request) },
    storeFunnelDay: {
      findMany: jest.fn().mockResolvedValue([
        {
          date: new Date('2026-10-10T00:00:00.000Z'),
          country: 'us',
          sourceType: 'search',
          pageType: 'productPage',
          impressions: 10,
          uniqueImpressions: 10,
          pageViews: 4,
          uniquePageViews: 4,
          gets: 1,
          uniqueGets: 1,
        },
      ]),
      aggregate: jest.fn().mockResolvedValue({
        _min: { date: new Date('2026-08-01T00:00:00.000Z') },
      }),
    },
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
    expect(prisma.storeFunnelDay.findMany).not.toHaveBeenCalled();
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
    expect(prisma.storeReportRequest.findFirst).not.toHaveBeenCalled();
  });

  it('asks only for an ongoing request in the requested state of an active connection', async () => {
    const { service, prisma } = build();

    await service.report('app_1', { days: 90 }, NOW);

    expect(prisma.storeReportRequest.findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        accessType: 'ONGOING',
        state: 'requested',
        connection: { store: 'APP_STORE', status: 'active' },
      },
      select: { id: true },
    });
  });

  it('reads only the rows of the range the series and windows need, in the market asked for', async () => {
    const { service, prisma } = build();

    const report = await service.report(
      'app_1',
      { days: 90, country: 'de' },
      NOW,
    );

    expect(prisma.storeFunnelDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it('throws 404 for an unknown app', async () => {
    const { service } = build({ app: null });

    await expect(
      service.report('nope', { days: 90 }, NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
