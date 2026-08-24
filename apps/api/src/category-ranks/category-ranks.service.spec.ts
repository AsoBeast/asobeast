import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { CategoryRanksService } from './category-ranks.service';

interface AppRow {
  id: string;
  storeAppId: string;
  country: string;
  store: Store;
  snapshots: { raw: unknown }[];
}

const app = (
  id: string,
  storeAppId: string,
  raw: unknown,
  country = 'us',
  store: Store = Store.APP_STORE,
): AppRow => ({ id, storeAppId, country, store, snapshots: [{ raw }] });

const makeService = (
  apps: AppRow[],
  chart: { storeAppId: string; title: string }[] = [],
) => {
  const upsert = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(apps) },
    categoryRank: { upsert },
  };
  const topCharts = jest.fn().mockResolvedValue(chart);
  const registry = { get: jest.fn().mockReturnValue({ topCharts }) };
  const service = new CategoryRanksService(
    prisma as unknown as PrismaService,
    registry as unknown as StoreProviderRegistry,
  );
  return { service, upsert, topCharts, registry, prisma };
};

describe('CategoryRanksService buckets', () => {
  it('dedupes buckets across apps sharing a genre', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: 6007, price: 0 }),
      app('a2', '222', { primaryGenreId: 6007, price: 0 }),
    ]);

    const buckets = await service.buckets(['a1', 'a2']);

    expect(buckets).toEqual([
      { collection: 'free', genre: '6007', country: 'us', store: 'APP_STORE' },
      {
        collection: 'free',
        genre: 'overall',
        country: 'us',
        store: 'APP_STORE',
      },
      {
        collection: 'grossing',
        genre: '6007',
        country: 'us',
        store: 'APP_STORE',
      },
      {
        collection: 'grossing',
        genre: 'overall',
        country: 'us',
        store: 'APP_STORE',
      },
    ]);
  });

  it('schedules grossing for every app alongside its price collection', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: 6007, price: 2.99 }),
    ]);

    const collections = (await service.buckets(['a1'])).map(
      (bucket) => bucket.collection,
    );

    expect(new Set(collections)).toEqual(new Set(['paid', 'grossing']));
  });

  it('splits free and paid apps into separate collections', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: 6007, price: 0 }),
      app('a2', '222', { primaryGenreId: 6014, price: 2.99 }),
    ]);

    const buckets = await service.buckets(['a1', 'a2']);

    expect(buckets).toEqual([
      { collection: 'free', genre: '6007', country: 'us', store: 'APP_STORE' },
      {
        collection: 'free',
        genre: 'overall',
        country: 'us',
        store: 'APP_STORE',
      },
      {
        collection: 'grossing',
        genre: '6007',
        country: 'us',
        store: 'APP_STORE',
      },
      {
        collection: 'grossing',
        genre: 'overall',
        country: 'us',
        store: 'APP_STORE',
      },
      { collection: 'paid', genre: '6014', country: 'us', store: 'APP_STORE' },
      {
        collection: 'paid',
        genre: 'overall',
        country: 'us',
        store: 'APP_STORE',
      },
      {
        collection: 'grossing',
        genre: '6014',
        country: 'us',
        store: 'APP_STORE',
      },
    ]);
  });

  it('skips apps without a snapshot or genre', async () => {
    const { service } = makeService([
      {
        id: 'a1',
        storeAppId: '111',
        country: 'us',
        store: Store.APP_STORE,
        snapshots: [],
      },
      app('a2', '222', { price: 0 }),
    ]);

    expect(await service.buckets(['a1', 'a2'])).toEqual([]);
  });
});

describe('CategoryRanksService checkCategory', () => {
  it('upserts the chart position for matching apps and null for absent ones', async () => {
    const { service, upsert, registry } = makeService(
      [
        app('a1', '111', { primaryGenreId: 6007, price: 0 }),
        app('a2', '999', { primaryGenreId: 6007, price: 0 }),
        app('a3', '333', { primaryGenreId: 6014, price: 0 }),
      ],
      [{ storeAppId: '111', title: 'First' }],
    );

    await service.checkCategory({
      collection: 'free',
      genre: '6007',
      country: 'us',
      store: 'APP_STORE',
      workspaceId: 'ws_default',
    });

    expect(registry.get).toHaveBeenCalledWith(Store.APP_STORE);
    expect(upsert).toHaveBeenCalledTimes(2);
    const positions = upsert.mock.calls.map(
      ([arg]) =>
        (arg as { create: { appId: string; position: number | null } }).create,
    );
    expect(positions).toEqual([
      expect.objectContaining({ appId: 'a1', position: 1 }),
      expect.objectContaining({ appId: 'a2', position: null }),
    ]);
  });

  it('matches every collection member for the overall genre bucket', async () => {
    const { service, upsert } = makeService(
      [
        app('a1', '111', { primaryGenreId: 6007, price: 0 }),
        app('a2', '222', { primaryGenreId: 6014, price: 0 }),
        app('a3', '333', { primaryGenreId: 6014, price: 5 }),
      ],
      [{ storeAppId: '222', title: 'Second' }],
    );

    await service.checkCategory({
      collection: 'free',
      genre: 'overall',
      country: 'us',
      store: 'APP_STORE',
      workspaceId: 'ws_default',
    });

    const appIds = upsert.mock.calls.map(
      ([arg]) => (arg as { create: { appId: string } }).create.appId,
    );
    expect(appIds).toEqual(['a1', 'a2']);
  });

  it('writes grossing positions for paid and free apps alike', async () => {
    const { service, upsert } = makeService(
      [
        app('a1', '111', { primaryGenreId: 6007, price: 0 }),
        app('a2', '222', { primaryGenreId: 6007, price: 4.99 }),
      ],
      [{ storeAppId: '222', title: 'Second' }],
    );

    await service.checkCategory({
      collection: 'grossing',
      genre: '6007',
      country: 'us',
      store: 'APP_STORE',
      workspaceId: 'ws_default',
    });

    const positions = upsert.mock.calls.map(
      ([arg]) =>
        (arg as { create: { appId: string; position: number | null } }).create,
    );
    expect(positions).toEqual([
      expect.objectContaining({ appId: 'a1', position: null }),
      expect.objectContaining({ appId: 'a2', position: 1 }),
    ]);
  });

  it('reruns idempotently via the same composite key', async () => {
    const { service, upsert } = makeService(
      [app('a1', '111', { primaryGenreId: 6007, price: 0 })],
      [{ storeAppId: '111', title: 'First' }],
    );

    await service.checkCategory({
      collection: 'free',
      genre: '6007',
      country: 'us',
      store: 'APP_STORE',
      workspaceId: 'ws_default',
    });
    await service.checkCategory({
      collection: 'free',
      genre: '6007',
      country: 'us',
      store: 'APP_STORE',
      workspaceId: 'ws_default',
    });

    for (const [arg] of upsert.mock.calls) {
      const where = (
        arg as {
          where: { appId_date_collection_genre: Record<string, unknown> };
        }
      ).where.appId_date_collection_genre;
      expect(where).toMatchObject({
        appId: 'a1',
        collection: 'free',
        genre: '6007',
      });
    }
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});

describe('CategoryRanksService history', () => {
  const makeHistoryService = (
    appRow: unknown,
    ranks: {
      collection: string;
      genre: string;
      date: Date;
      position: number | null;
    }[],
  ) => {
    const prisma = {
      app: { findFirst: jest.fn().mockResolvedValue(appRow) },
      categoryRank: { findMany: jest.fn().mockResolvedValue(ranks) },
    };
    const registry = { get: jest.fn() };
    const service = new CategoryRanksService(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
    );
    return { service };
  };

  it('throws NotFound for an unknown app', async () => {
    const { service } = makeHistoryService(null, []);
    await expect(service.history('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('groups by collection and genre with the newest position as current', async () => {
    const appRow = {
      id: 'a1',
      snapshots: [{ raw: { primaryGenre: 'Productivity' } }],
    };
    const ranks = [
      {
        collection: 'free',
        genre: '6007',
        date: new Date('2026-07-09'),
        position: 12,
      },
      {
        collection: 'free',
        genre: '6007',
        date: new Date('2026-07-10'),
        position: 8,
      },
      {
        collection: 'free',
        genre: 'overall',
        date: new Date('2026-07-10'),
        position: 140,
      },
    ];
    const { service } = makeHistoryService(appRow, ranks);

    const result = await service.history('a1', {});

    expect(result.series).toEqual([
      {
        collection: 'free',
        genre: '6007',
        genreName: 'Productivity',
        current: 8,
        points: [
          { date: '2026-07-09', position: 12 },
          { date: '2026-07-10', position: 8 },
        ],
      },
      {
        collection: 'free',
        genre: 'overall',
        genreName: 'Overall',
        current: 140,
        points: [{ date: '2026-07-10', position: 140 }],
      },
    ]);
  });
});
