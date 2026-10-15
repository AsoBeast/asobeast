import { ChartKey } from '@asobeast/shared';
import { Prisma, Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreRequestError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ChartItem } from '../store-providers/types';
import { ChartCaptureService, StoredChart } from './chart-capture.service';

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

const build = (items: ChartItem[] = [], stored: StoredChart | null = null) => {
  const prisma = {
    chartCapture: {
      findUnique: jest.fn().mockResolvedValue(stored),
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

  it('lets a concurrent capture win', async () => {
    const { service, prisma } = build([{ storeAppId: '111', title: 'First' }]);
    const winner = { ...STORED, id: 'cap-other' };
    prisma.chartCapture.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.chartCapture.create.mockRejectedValue(uniqueViolation());

    await expect(service.captureToday(KEY)).resolves.toBe(winner);
  });

  it('spends only when the store is reached', async () => {
    const spend = jest.fn().mockResolvedValue(undefined);
    const stored = build([], STORED);
    const missing = build([{ storeAppId: '111', title: 'First' }]);

    await stored.service.captureToday(KEY, spend);
    expect(spend).not.toHaveBeenCalled();

    await missing.service.captureToday(KEY, spend);
    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend.mock.invocationCallOrder[0]).toBeLessThan(
      missing.topCharts.mock.invocationCallOrder[0],
    );
  });

  it('never reaches the store when the allowance is spent', async () => {
    const { service, topCharts } = build([{ storeAppId: '111', title: 'A' }]);
    const refused = new Error('spent');

    await expect(
      service.captureToday(KEY, () => Promise.reject(refused)),
    ).rejects.toBe(refused);
    expect(topCharts).not.toHaveBeenCalled();
  });

  it('refuses an empty feed so the chart is fetched again', async () => {
    const { service, prisma } = build([]);

    await expect(service.captureToday(KEY)).rejects.toBeInstanceOf(
      StoreRequestError,
    );
    expect(prisma.chartCapture.create).not.toHaveBeenCalled();
  });

  it('never catches a store failure', async () => {
    const { service, prisma, topCharts } = build();
    const failure = new StoreRequestError('APP_STORE', 'topCharts', 'boom');
    topCharts.mockRejectedValue(failure);

    await expect(service.captureToday(KEY)).rejects.toBe(failure);

    expect(prisma.chartCapture.create).not.toHaveBeenCalled();
  });
});
