import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CHART_DEPTH } from '@asobeast/shared';
import { ChartCaptureService } from '../charts/chart-capture.service';
import { scrapedAppStoreRaw } from '../store-providers/app-store-scraped.fixture';
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
  store: Store = Store.APP_STORE,
) => {
  const upsert = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(apps) },
    categoryRank: { upsert },
  };
  const captureToday = jest.fn().mockResolvedValue({
    depth: CHART_DEPTH[store],
    entries: chart.map((item, index) => ({
      position: index + 1,
      storeAppId: item.storeAppId,
      title: item.title,
    })),
  });
  const service = new CategoryRanksService(
    prisma as unknown as PrismaService,
    { captureToday } as unknown as ChartCaptureService,
  );
  return { service, upsert, captureToday, prisma };
};

const bucket = (collection: string, genre: string) => ({
  collection,
  genre,
  country: 'us',
  store: 'APP_STORE',
});

describe('CategoryRanksService buckets', () => {
  it('schedules an app stored the way the App Store scraper maps it', async () => {
    const { service } = makeService([
      app('a1', '425073498', await scrapedAppStoreRaw()),
    ]);

    const buckets = await service.buckets(['a1']);

    expect(buckets).toEqual([
      bucket('free', '6027'),
      bucket('free', 'overall'),
      bucket('paid', '6027'),
      bucket('paid', 'overall'),
      bucket('grossing', '6027'),
      bucket('grossing', 'overall'),
    ]);
  });

  it('still schedules an app whose snapshot stored the genre as a number', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: 6007, price: 0 }),
    ]);

    const genres = (await service.buckets(['a1'])).map(
      (bucket) => bucket.genre,
    );

    expect(new Set(genres)).toEqual(new Set(['6007', 'overall']));
  });

  it('dedupes buckets across apps sharing a genre', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: '6007', price: 0 }),
      app('a2', '222', { primaryGenreId: '6007', price: 0 }),
    ]);

    const buckets = await service.buckets(['a1', 'a2']);

    expect(buckets).toEqual([
      bucket('free', '6007'),
      bucket('free', 'overall'),
      bucket('paid', '6007'),
      bucket('paid', 'overall'),
      bucket('grossing', '6007'),
      bucket('grossing', 'overall'),
    ]);
  });

  it('schedules every chart kind for an app whatever its price', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: '6007', price: 2.99 }),
    ]);

    const collections = (await service.buckets(['a1'])).map(
      (bucket) => bucket.collection,
    );

    expect(new Set(collections)).toEqual(new Set(['free', 'paid', 'grossing']));
  });

  it('schedules one bucket per kind however the apps are priced', async () => {
    const { service } = makeService([
      app('a1', '111', { primaryGenreId: '6007', price: 0 }),
      app('a2', '222', { primaryGenreId: '6014', price: 2.99 }),
    ]);

    const buckets = await service.buckets(['a1', 'a2']);

    expect(buckets).toEqual([
      bucket('free', '6007'),
      bucket('free', 'overall'),
      bucket('paid', '6007'),
      bucket('paid', 'overall'),
      bucket('grossing', '6007'),
      bucket('grossing', 'overall'),
      bucket('free', '6014'),
      bucket('paid', '6014'),
      bucket('grossing', '6014'),
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

describe('CategoryRanksService rankedCharts', () => {
  const keysOf = (charts: { collection: string; genre: string }[]) =>
    charts.map(({ collection, genre }) => `${collection}~${genre}`).sort();

  it('reports the charts an app is ranked in', async () => {
    const free = makeService([
      app('a1', '425073498', await scrapedAppStoreRaw()),
    ]);
    const paid = makeService([
      app('a2', '222', { primaryGenreId: 6014, price: 4.99 }),
    ]);
    const bare = makeService([
      {
        id: 'a3',
        storeAppId: '333',
        country: 'us',
        store: Store.APP_STORE,
        snapshots: [],
      },
    ]);

    expect(keysOf(await free.service.rankedCharts('a1'))).toEqual([
      'free~6027',
      'free~overall',
      'grossing~6027',
      'grossing~overall',
    ]);
    expect(keysOf(await paid.service.rankedCharts('a2'))).toEqual([
      'grossing~6014',
      'grossing~overall',
      'paid~6014',
      'paid~overall',
    ]);
    expect(await bare.service.rankedCharts('a3')).toEqual([]);
  });

  it('ranks an app only in charts the daily run reads', async () => {
    const { service } = makeService([
      app('a1', '425073498', await scrapedAppStoreRaw()),
    ]);

    const ranked = keysOf(await service.rankedCharts('a1'));
    const read = keysOf(await service.buckets(['a1']));

    expect(read).toEqual(expect.arrayContaining(ranked));
    expect(read.filter((key) => !ranked.includes(key))).toEqual([
      'paid~6027',
      'paid~overall',
    ]);
  });

  it('writes the rank rows that rankedCharts names', async () => {
    const { service, upsert } = makeService([
      app('a1', '425073498', await scrapedAppStoreRaw()),
    ]);

    for (const read of await service.buckets(['a1'])) {
      await service.checkCategory({ ...read, workspaceId: 'ws' });
    }
    const written = upsert.mock.calls.map(
      ([args]: [{ create: { collection: string; genre: string } }]) =>
        `${args.create.collection}~${args.create.genre}`,
    );

    expect(written.sort()).toEqual(keysOf(await service.rankedCharts('a1')));
  });
});

describe('CategoryRanksService checkCategory', () => {
  it('upserts the chart position for matching apps and null for absent ones', async () => {
    const { service, upsert, captureToday } = makeService(
      [
        app('a1', '111', { primaryGenreId: '6007', price: 0 }),
        app('a2', '999', { primaryGenreId: '6007', price: 0 }),
        app('a3', '333', { primaryGenreId: '6014', price: 0 }),
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

    expect(captureToday).toHaveBeenCalledWith({
      store: Store.APP_STORE,
      country: 'us',
      collection: 'free',
      genre: '6007',
      device: 'iphone',
    });
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

  it("asks the capture for the bucket's chart key", async () => {
    const { service, captureToday } = makeService([], [], Store.GOOGLE_PLAY);

    await service.checkCategory({
      collection: 'grossing',
      genre: 'GAME_PUZZLE',
      country: 'de',
      store: 'GOOGLE_PLAY',
      workspaceId: 'ws_default',
    });

    expect(captureToday).toHaveBeenCalledWith({
      store: 'GOOGLE_PLAY',
      country: 'de',
      collection: 'grossing',
      genre: 'GAME_PUZZLE',
      device: 'android',
    });
  });

  it('writes no rank row for an app in a chart its price class never enters', async () => {
    const { service, upsert } = makeService(
      [
        app('a1', '111', { primaryGenreId: '6007', price: 0 }),
        app('a2', '222', { primaryGenreId: '6007', price: 4.99 }),
      ],
      [{ storeAppId: '222', title: 'Second' }],
    );

    await service.checkCategory({
      collection: 'paid',
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
      expect.objectContaining({ appId: 'a2', position: 1 }),
    ]);
  });

  it('matches every collection member for the overall genre bucket', async () => {
    const { service, upsert } = makeService(
      [
        app('a1', '111', { primaryGenreId: '6007', price: 0 }),
        app('a2', '222', { primaryGenreId: '6014', price: 0 }),
        app('a3', '333', { primaryGenreId: '6014', price: 5 }),
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
        app('a1', '111', { primaryGenreId: '6007', price: 0 }),
        app('a2', '222', { primaryGenreId: '6007', price: 4.99 }),
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

  it.each([
    [Store.APP_STORE, '6007', 100],
    [Store.GOOGLE_PLAY, 'PRODUCTIVITY', 200],
  ])('stores the %s depth the capture records', async (store, genre, depth) => {
    const { service, upsert } = makeService(
      [
        app(
          'a1',
          '111',
          { primaryGenreId: genre, genreId: genre, price: 0 },
          'us',
          store,
        ),
      ],
      [{ storeAppId: '111', title: 'First' }],
      store,
    );

    await service.checkCategory({
      collection: 'free',
      genre,
      country: 'us',
      store,
      workspaceId: 'ws_default',
    });

    const [[arg]] = upsert.mock.calls as [
      [{ create: { depth: number }; update: { depth: number } }],
    ];
    expect(arg.create.depth).toBe(depth);
    expect(arg.update.depth).toBe(depth);
  });

  it('reruns idempotently via the same composite key', async () => {
    const { service, upsert } = makeService(
      [app('a1', '111', { primaryGenreId: '6007', price: 0 })],
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
    const service = new CategoryRanksService(
      prisma as unknown as PrismaService,
      {} as ChartCaptureService,
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
