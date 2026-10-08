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
      where: { country: 'de' },
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
