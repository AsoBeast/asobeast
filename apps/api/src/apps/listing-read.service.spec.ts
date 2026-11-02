import { NotFoundException } from '@nestjs/common';
import { App, AppSnapshot, Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toSnapshotData } from './apps.mapper';
import { AppWithListings, ListingReadService } from './listing-read.service';

const CREATED_AT = new Date('2026-07-01T00:00:00.000Z');

function appRow(id: string, primaryAppId: string | null = null): App {
  return {
    id,
    workspaceId: 'ws_1',
    store: Store.APP_STORE,
    storeAppId: `store_${id}`,
    country: 'us',
    name: id,
    iconUrl: null,
    isCompetitor: primaryAppId !== null,
    primaryAppId,
    groupId: null,
    createdAt: CREATED_AT,
  };
}

function listing(appId: string, title: string): AppSnapshot {
  return {
    ...toSnapshotData(
      appId,
      {
        store: Store.APP_STORE,
        storeAppId: `store_${appId}`,
        title,
        raw: {},
        searchable: true,
      },
      'de',
    ),
    id: `snap_${appId}`,
    capturedAt: new Date('2026-07-02T00:00:00.000Z'),
  } as AppSnapshot;
}

const PRIMARY: AppWithListings = {
  ...appRow('app_1'),
  competitors: [appRow('rival_1', 'app_1'), appRow('rival_2', 'app_1')],
  group: null,
};

function serviceWith(loaded: unknown) {
  const findFirst = jest.fn().mockResolvedValue(loaded);
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    app: { findFirst },
    appSnapshot: { findMany },
  } as unknown as PrismaService;
  return { service: new ListingReadService(prisma), findFirst, findMany };
}

describe('ListingReadService.marketDetail', () => {
  it('loads only the newest listing of each app in the market', async () => {
    const newest = {
      where: { country: 'de', localization: null },
      orderBy: { capturedAt: 'desc' },
      take: 1,
    };
    const { service, findFirst, findMany } = serviceWith({
      snapshots: [listing('app_1', 'Gewohnheiten')],
      competitors: [
        { id: 'rival_1', snapshots: [listing('rival_1', 'Rivale')] },
        { id: 'rival_2', snapshots: [] },
      ],
    });

    const detail = await service.marketDetail(PRIMARY, 'de');

    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      select: {
        snapshots: newest,
        competitors: { select: { id: true, snapshots: newest } },
      },
    });
    expect(detail.latestSnapshot?.title).toBe('Gewohnheiten');
    expect(
      detail.competitors.map((rival) => rival.latestSnapshot?.title ?? null),
    ).toEqual(['Rivale', null]);
  });

  it('answers 404 when the market has no listing of the app', async () => {
    const { service } = serviceWith({ snapshots: [], competitors: [] });

    await expect(service.marketDetail(PRIMARY, 'de')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

const HOME_AT = new Date('2026-07-01T00:00:00.000Z');
const DE_AT = new Date('2026-07-02T00:00:00.000Z');

function marketsServiceWith(
  groups: unknown[],
  app: unknown = { country: 'us', primaryAppId: null },
) {
  const groupBy = jest.fn().mockResolvedValue(groups);
  const findMany = jest.fn().mockResolvedValue([
    { country: null, ratingAvg: 4.8, ratingCount: 24000 },
    { country: 'de', ratingAvg: 4.4, ratingCount: 5200 },
  ]);
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(app) },
    appSnapshot: { groupBy, findMany },
    keyword: { findMany: jest.fn().mockResolvedValue([]) },
    appLocalization: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return { service: new ListingReadService(prisma), groupBy, findMany };
}

const HOME_GROUP = {
  country: null,
  localization: null,
  _max: { capturedAt: HOME_AT },
};
const DE_GROUP = {
  country: 'de',
  localization: null,
  _max: { capturedAt: DE_AT },
};

const askedFor = (findMany: jest.Mock) =>
  (findMany.mock.calls[0] as [{ where: { OR: unknown[] } }])[0].where.OR;

describe('ListingReadService.markets', () => {
  it('reads only the newest default listing of each market', async () => {
    const { service, findMany } = marketsServiceWith([HOME_GROUP, DE_GROUP]);

    await service.markets('app_1');

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        OR: [
          { country: null, localization: null, capturedAt: HOME_AT },
          { country: 'de', localization: null, capturedAt: DE_AT },
        ],
      },
      select: { country: true, ratingAvg: true, ratingCount: true },
    });
  });

  it('answers the rating of each market beside its capture time', async () => {
    const { service } = marketsServiceWith([HOME_GROUP, DE_GROUP]);

    const markets = await service.markets('app_1');

    expect(
      markets.map(({ country, capturedAt, ratingAvg, ratingCount }) => ({
        country,
        capturedAt,
        ratingAvg,
        ratingCount,
      })),
    ).toEqual([
      {
        country: 'us',
        capturedAt: HOME_AT.toISOString(),
        ratingAvg: 4.8,
        ratingCount: 24000,
      },
      {
        country: 'de',
        capturedAt: DE_AT.toISOString(),
        ratingAvg: 4.4,
        ratingCount: 5200,
      },
    ]);
  });

  it('never asks for a localized listing', async () => {
    const { service, findMany } = marketsServiceWith([
      HOME_GROUP,
      DE_GROUP,
      {
        country: 'de',
        localization: 'de',
        _max: { capturedAt: new Date('2026-07-03T00:00:00.000Z') },
      },
    ]);

    await service.markets('app_1');

    expect(askedFor(findMany)).toEqual([
      { country: null, localization: null, capturedAt: HOME_AT },
      { country: 'de', localization: null, capturedAt: DE_AT },
    ]);
  });

  it('answers a home market without a listing with no rating', async () => {
    const { service, findMany } = marketsServiceWith([DE_GROUP]);
    findMany.mockResolvedValue([
      { country: 'de', ratingAvg: 4.4, ratingCount: 5200 },
    ]);

    const markets = await service.markets('app_1');

    expect(askedFor(findMany)).toEqual([
      { country: 'de', localization: null, capturedAt: DE_AT },
    ]);
    expect(markets[0]).toMatchObject({
      country: 'us',
      home: true,
      capturedAt: null,
      ratingAvg: null,
      ratingCount: null,
    });
  });

  it('answers 404 for an unknown app before reading any listing', async () => {
    const { service, groupBy } = marketsServiceWith([], null);

    await expect(service.markets('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(groupBy).not.toHaveBeenCalled();
  });
});
