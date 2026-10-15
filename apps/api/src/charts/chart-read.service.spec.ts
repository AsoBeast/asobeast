import { ChartKey } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { ChartCaptureService, StoredChart } from './chart-capture.service';
import { ChartFollowsService } from './chart-follows.service';
import { ChartPageQuery, ChartReadService } from './chart-read.service';

const KEY: ChartKey = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
};

const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

const chart = (date: string, ids: string[]): StoredChart => ({
  id: date,
  date: day(date),
  depth: 100,
  capturedAt: new Date(`${date}T03:00:00.000Z`),
  entries: ids.map((storeAppId, index) => ({
    position: index + 1,
    app: {
      storeAppId,
      title: storeAppId,
      developer: null,
      iconUrl: null,
      genreId: storeAppId === 'a' ? '6014' : null,
      free: null,
    },
  })),
});

const build = (current: StoredChart | null, previous: StoredChart | null) => {
  const captures = {
    stored: jest.fn().mockResolvedValue(current),
    newestOnOrBefore: jest
      .fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(previous),
    capturedDates: jest.fn().mockResolvedValue([]),
  };
  const prisma = { app: { findMany: jest.fn().mockResolvedValue([]) } };
  const service = new ChartReadService(
    captures as unknown as ChartCaptureService,
    { of: jest.fn().mockResolvedValue(null) } as unknown as ChartFollowsService,
    prisma as unknown as PrismaService,
    { through: jest.fn() } as unknown as ProxyEgress,
  );
  return { service, captures };
};

const query = (over: Partial<ChartPageQuery> = {}): ChartPageQuery => ({
  ...KEY,
  compare: '1d',
  dates: 90,
  ...over,
});

describe('ChartReadService.page', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T09:30:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('reads the newest capture when no day is given', async () => {
    const { service, captures } = build(chart('2026-10-15', ['a']), null);

    await service.page(query());

    expect(captures.newestOnOrBefore).toHaveBeenNthCalledWith(
      1,
      KEY,
      day('2026-10-15'),
    );
    expect(captures.stored).not.toHaveBeenCalled();
  });

  it('reads the given day and compares within one more window', async () => {
    const { service, captures } = build(
      chart('2026-10-10', ['a']),
      chart('2026-10-03', ['a']),
    );
    captures.newestOnOrBefore
      .mockReset()
      .mockResolvedValue(chart('2026-10-03', ['a']));

    const page = await service.page(
      query({ date: '2026-10-10', compare: '7d' }),
    );

    expect(captures.stored).toHaveBeenCalledWith(KEY, day('2026-10-10'));
    expect(captures.newestOnOrBefore).toHaveBeenCalledWith(
      KEY,
      day('2026-10-03'),
      day('2026-09-26'),
    );
    expect(page.comparison?.date).toBe('2026-10-03');
  });

  it('maps a stored row with null listing fields and the genre name', async () => {
    const { service } = build(chart('2026-10-15', ['a', 'b']), null);

    const page = await service.page(query());

    expect(page.entries).toEqual([
      {
        position: 1,
        storeAppId: 'a',
        title: 'a',
        developer: null,
        iconUrl: null,
        genreId: '6014',
        genreName: 'Games',
        free: null,
        previous: null,
        delta: null,
        movement: 'none',
      },
      expect.objectContaining({ storeAppId: 'b', genreName: null }),
    ]);
  });

  it('compares an empty day against nothing', async () => {
    const { service, captures } = build(null, null);

    const page = await service.page(query({ date: '2026-10-14' }));

    expect(captures.newestOnOrBefore).not.toHaveBeenCalled();
    expect(page.capture).toBeNull();
    expect(page.entries).toEqual([]);
  });
});
