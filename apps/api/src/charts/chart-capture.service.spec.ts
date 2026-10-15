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
    chartApp: {
      upsert: jest.fn(({ create }: { create: { storeAppId: string } }) =>
        Promise.resolve({ id: `app-${create.storeAppId}` }),
      ),
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
    expect(prisma.chartApp.upsert).toHaveBeenNthCalledWith(1, {
      where: { store_storeAppId: { store: 'APP_STORE', storeAppId: '111' } },
      create: {
        store: 'APP_STORE',
        storeAppId: '111',
        title: 'First',
        developer: 'Acme',
        iconUrl: 'https://example.com/a.png',
        genreId: '6014',
        free: true,
      },
      update: {
        title: 'First',
        developer: 'Acme',
        iconUrl: 'https://example.com/a.png',
        genreId: '6014',
        free: true,
        seenAt: new Date('2026-10-15T09:30:00.000Z'),
      },
      select: { id: true },
    });
    const [{ data }] = prisma.chartCapture.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toEqual({
      ...KEY,
      date: new Date('2026-10-15T00:00:00.000Z'),
      depth: 100,
      entries: {
        create: [
          { position: 1, chartAppId: 'app-111' },
          { position: 2, chartAppId: 'app-222' },
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
      { position: 1, chartAppId: 'app-111' },
      { position: 2, chartAppId: 'app-222' },
    ]);
    expect(prisma.chartApp.upsert).toHaveBeenCalledTimes(2);
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

  it('never catches a store failure', async () => {
    const { service, prisma, topCharts } = build();
    const failure = new StoreRequestError('APP_STORE', 'topCharts', 'boom');
    topCharts.mockRejectedValue(failure);

    await expect(service.captureToday(KEY)).rejects.toBe(failure);

    expect(prisma.chartApp.upsert).not.toHaveBeenCalled();
    expect(prisma.chartCapture.create).not.toHaveBeenCalled();
  });
});
