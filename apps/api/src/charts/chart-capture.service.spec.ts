import { ChartKey } from '@asobeast/shared';
import { Prisma, Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreRequestError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ChartItem } from '../store-providers/types';
import { ChartCaptureService, StoredChart } from './chart-capture.service';
import { ChartListsNoAppsError } from './chart-lists-no-apps.error';

const KEY: ChartKey = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
};

const STORED: StoredChart = {
  id: 'cap1',
  date: new Date('2026-10-15T00:00:00.000Z'),
  depth: 100,
  capturedAt: new Date('2026-10-15T03:00:00.000Z'),
  entries: [],
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: '7.8.0',
  });

interface History {
  lastListed?: { date: Date } | null;
  latestEntries?: number | null;
}

const build = (
  items: ChartItem[] = [],
  stored: StoredChart | null = null,
  history: History = {},
) => {
  const findFirst = jest.fn((args: { where: Record<string, unknown> }) =>
    Promise.resolve(
      'entries' in args.where
        ? (history.lastListed ?? null)
        : history.latestEntries == null
          ? null
          : { _count: { entries: history.latestEntries } },
    ),
  );
  const prisma = {
    chartCapture: {
      findUnique: jest.fn().mockResolvedValue(stored),
      findFirst,
      create: jest.fn().mockResolvedValue(STORED),
    },
  };
  const topCharts = jest.fn().mockResolvedValue(items);
  const registry = { get: jest.fn().mockReturnValue({ topCharts }) };
  const service = new ChartCaptureService(
    prisma as unknown as PrismaService,
    registry as unknown as StoreProviderRegistry,
  );
  return { service, prisma, topCharts, registry };
};

describe('ChartCaptureService.captureToday', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T09:30:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it("answers today's capture without a store call", async () => {
    const { service, topCharts, prisma } = build([], STORED);

    await expect(service.captureToday(KEY)).resolves.toBe(STORED);

    expect(topCharts).not.toHaveBeenCalled();
    expect(prisma.chartCapture.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          store_country_collection_genre_device_date: {
            ...KEY,
            date: new Date('2026-10-15T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('fetches, stores and answers when today is missing', async () => {
    const { service, topCharts, prisma, registry } = build([
      {
        storeAppId: '111',
        title: 'First',
        developer: 'Acme',
        iconUrl: 'https://example.com/a.png',
        genreId: '6014',
        free: true,
      },
      { storeAppId: '222', title: 'Second' },
    ]);

    await expect(service.captureToday(KEY)).resolves.toBe(STORED);

    expect(registry.get).toHaveBeenCalledWith(Store.APP_STORE);
    expect(topCharts).toHaveBeenCalledWith('free', '6014', 100, 'us');
    const [{ data }] = prisma.chartCapture.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toEqual({
      ...KEY,
      date: new Date('2026-10-15T00:00:00.000Z'),
      depth: 100,
      entries: {
        create: [
          {
            position: 1,
            storeAppId: '111',
            title: 'First',
            developer: 'Acme',
            iconUrl: 'https://example.com/a.png',
            genreId: '6014',
            free: true,
          },
          { position: 2, storeAppId: '222', title: 'Second' },
        ],
      },
    });
  });

  it('stores the depth the store was asked for', async () => {
    const { service, prisma, topCharts } = build([
      { storeAppId: 'com.a', title: 'A' },
    ]);

    await service.captureToday({
      ...KEY,
      store: 'GOOGLE_PLAY',
      genre: 'GAME_PUZZLE',
      device: 'android',
    });

    expect(topCharts).toHaveBeenCalledWith('free', 'GAME_PUZZLE', 200, 'us');
    const [{ data }] = prisma.chartCapture.create.mock.calls[0] as [
      { data: { depth: number } },
    ];
    expect(data.depth).toBe(200);
  });

  it('keeps the first position of a duplicated id', async () => {
    const { service, prisma } = build([
      { storeAppId: '111', title: 'First' },
      { storeAppId: '222', title: 'Second' },
      { storeAppId: '111', title: 'First again' },
    ]);

    await service.captureToday(KEY);

    const [{ data }] = prisma.chartCapture.create.mock.calls[0] as [
      { data: { entries: { create: unknown[] } } },
    ];
    expect(data.entries.create).toEqual([
      { position: 1, storeAppId: '111', title: 'First' },
      { position: 2, storeAppId: '222', title: 'Second' },
    ]);
  });

  it('lets a concurrent capture from another process win', async () => {
    const { service, prisma } = build([{ storeAppId: '111', title: 'First' }]);
    const winner = { ...STORED, id: 'cap-other' };
    prisma.chartCapture.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.chartCapture.create.mockRejectedValue(uniqueViolation());

    await expect(service.captureToday(KEY)).resolves.toBe(winner);
  });

  const deferredFeed = (topCharts: jest.Mock) => {
    let answer: (items: ChartItem[]) => void = () => undefined;
    topCharts.mockReturnValueOnce(
      new Promise<ChartItem[]>((resolve) => {
        answer = resolve;
      }),
    );
    return (items: ChartItem[]) => answer(items);
  };

  it('reaches the store once and spends once for two concurrent first captures', async () => {
    const { service, prisma, topCharts } = build();
    const answer = deferredFeed(topCharts);
    const spend = jest.fn().mockResolvedValue(undefined);

    const first = service.captureToday(KEY, { spend });
    const second = service.captureToday(KEY, { spend });
    await jest.advanceTimersByTimeAsync(0);
    answer([{ storeAppId: '111', title: 'First' }]);

    const results = await Promise.allSettled([first, second]);

    expect(topCharts).toHaveBeenCalledTimes(1);
    expect(spend).toHaveBeenCalledTimes(1);
    expect(prisma.chartCapture.create).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { status: 'fulfilled', value: STORED },
      { status: 'fulfilled', value: STORED },
    ]);
  });

  it('starts a new flight once the first settled', async () => {
    const { service, prisma, topCharts } = build([
      { storeAppId: '111', title: 'First' },
    ]);

    await service.captureToday(KEY);
    prisma.chartCapture.findUnique.mockResolvedValue(STORED);
    await expect(service.captureToday(KEY)).resolves.toBe(STORED);

    expect(topCharts).toHaveBeenCalledTimes(1);
    expect(prisma.chartCapture.findUnique).toHaveBeenCalledTimes(2);
  });

  it('captures two kinds of one category in flights of their own', async () => {
    const { service, topCharts } = build([
      { storeAppId: '111', title: 'First' },
    ]);

    await Promise.all([
      service.captureToday(KEY),
      service.captureToday({ ...KEY, collection: 'paid' }),
    ]);

    expect(topCharts).toHaveBeenCalledTimes(2);
  });

  it('shares a store failure with a concurrent capture', async () => {
    const { service, topCharts } = build();
    const failure = new StoreRequestError('APP_STORE', 'topCharts', 'boom');
    topCharts.mockRejectedValue(failure);

    const results = await Promise.allSettled([
      service.captureToday(KEY),
      service.captureToday(KEY),
    ]);

    expect(results).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ]);
    expect(topCharts).toHaveBeenCalledTimes(1);
  });

  it('captures on its own allowance when the first caller was refused before the store', async () => {
    const { service, topCharts } = build([
      { storeAppId: '111', title: 'First' },
    ]);
    const refused = new Error('spent');
    const spend = jest.fn().mockResolvedValue(undefined);

    const results = await Promise.allSettled([
      service.captureToday(KEY, { spend: () => Promise.reject(refused) }),
      service.captureToday(KEY, { spend }),
    ]);

    expect(results).toEqual([
      { status: 'rejected', reason: refused },
      { status: 'fulfilled', value: STORED },
    ]);
    expect(spend).toHaveBeenCalledTimes(1);
    expect(topCharts).toHaveBeenCalledTimes(1);
  });

  it('spends only when the store is reached', async () => {
    const spend = jest.fn().mockResolvedValue(undefined);
    const stored = build([], STORED);
    const missing = build([{ storeAppId: '111', title: 'First' }]);

    await stored.service.captureToday(KEY, { spend });
    expect(spend).not.toHaveBeenCalled();

    await missing.service.captureToday(KEY, { spend });
    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend.mock.invocationCallOrder[0]).toBeLessThan(
      missing.topCharts.mock.invocationCallOrder[0],
    );
  });

  it('never reaches the store when the allowance is spent', async () => {
    const { service, topCharts } = build([{ storeAppId: '111', title: 'A' }]);
    const refused = new Error('spent');

    await expect(
      service.captureToday(KEY, { spend: () => Promise.reject(refused) }),
    ).rejects.toBe(refused);
    expect(topCharts).not.toHaveBeenCalled();
  });

  it('refuses an empty answer on an early attempt for a chart with no history', async () => {
    const { service, prisma } = build([]);

    await expect(
      service.captureToday(KEY, { finalAttempt: false }),
    ).rejects.toBeInstanceOf(StoreRequestError);
    expect(prisma.chartCapture.create).not.toHaveBeenCalled();
  });

  it('stores an empty capture on the last attempt for a chart with no history', async () => {
    const { service, prisma } = build([]);

    await expect(
      service.captureToday(KEY, { finalAttempt: true }),
    ).resolves.toBe(STORED);
    const [created] = prisma.chartCapture.create.mock.calls[0] as [
      { data: { date: Date; depth: number; entries: unknown } },
    ];
    expect(created.data).toMatchObject({
      date: new Date('2026-10-15T00:00:00.000Z'),
      depth: 100,
      entries: { create: [] },
    });
  });

  it.each([
    [false, '2026-10-14'],
    [true, '2026-10-14'],
    [false, '2026-10-08'],
    [true, '2026-10-08'],
  ])(
    'refuses an empty answer on every attempt when the chart listed apps within a week (final %s, listed %s)',
    async (finalAttempt, listed) => {
      const { service, prisma } = build([], null, {
        lastListed: { date: new Date(`${listed}T00:00:00.000Z`) },
        latestEntries: 3,
      });

      await expect(
        service.captureToday(KEY, { finalAttempt }),
      ).rejects.toBeInstanceOf(StoreRequestError);
      expect(prisma.chartCapture.create).not.toHaveBeenCalled();
      expect(prisma.chartCapture.findFirst).toHaveBeenCalledWith({
        where: {
          ...KEY,
          date: { lt: new Date('2026-10-15T00:00:00.000Z') },
          entries: { some: {} },
        },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
    },
  );

  it('treats a last listing older than a week as no history', async () => {
    const history = {
      lastListed: { date: new Date('2026-10-07T00:00:00.000Z') },
      latestEntries: 3,
    };
    const early = build([], null, history);
    const last = build([], null, history);

    await expect(
      early.service.captureToday(KEY, { finalAttempt: false }),
    ).rejects.toBeInstanceOf(StoreRequestError);
    await expect(
      last.service.captureToday(KEY, { finalAttempt: true }),
    ).resolves.toBe(STORED);
  });

  it.each([false, true, undefined])(
    'stores an empty capture at once for a chart already empty before (final %s)',
    async (finalAttempt) => {
      const { service, prisma } = build([], null, { latestEntries: 0 });

      await expect(service.captureToday(KEY, { finalAttempt })).resolves.toBe(
        STORED,
      );
      expect(prisma.chartCapture.create).toHaveBeenCalledTimes(1);
    },
  );

  it('answers an on demand request for a chart with no history without storing it', async () => {
    const spend = jest.fn().mockResolvedValue(undefined);
    const { service, prisma } = build([]);

    await expect(service.captureToday(KEY, { spend })).rejects.toBeInstanceOf(
      ChartListsNoAppsError,
    );
    expect(spend).toHaveBeenCalledTimes(1);
    expect(prisma.chartCapture.create).not.toHaveBeenCalled();
  });

  it('does not read the history for a feed with apps', async () => {
    const { service, prisma } = build([{ storeAppId: '111', title: 'A' }]);

    await service.captureToday(KEY, { finalAttempt: false });

    expect(prisma.chartCapture.findFirst).not.toHaveBeenCalled();
  });

  it('routes only the store request through the egress it is given', async () => {
    const through = jest.fn(<T>(work: () => Promise<T>) => work());
    const stored = build([], STORED);
    const missing = build([{ storeAppId: '111', title: 'First' }]);

    await stored.service.captureToday(KEY, { through });
    expect(through).not.toHaveBeenCalled();

    await missing.service.captureToday(KEY, { through });
    expect(through).toHaveBeenCalledTimes(1);
  });

  it('never catches a store failure', async () => {
    const { service, prisma, topCharts } = build();
    const failure = new StoreRequestError('APP_STORE', 'topCharts', 'boom');
    topCharts.mockRejectedValue(failure);

    await expect(service.captureToday(KEY)).rejects.toBe(failure);

    expect(prisma.chartCapture.create).not.toHaveBeenCalled();
  });
});
