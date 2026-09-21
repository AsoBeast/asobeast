import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem, SuggestItem } from '../store-providers/types';
import { StatsCollectorService } from './stats-collector.service';

const daysAgo = (days: number): Date =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function buildSearch(): SearchItem[] {
  return Array.from({ length: 40 }, (_, index) => ({
    storeAppId: `app${index}`,
    title: index < 12 ? `Puzzle Game ${index}` : `Other App ${index}`,
    ratingCount: 1000 + index,
    ratingAvg: 4.5,
    updatedAt: daysAgo(10),
  }));
}

function buildProviderWith(suggestFn: jest.Mock) {
  const search = jest.fn().mockResolvedValue(buildSearch());
  const registry = {
    get: jest.fn().mockReturnValue({ search, suggest: suggestFn }),
  } as unknown as StoreProviderRegistry;
  return { registry, search, suggestFn };
}

const buildProvider = (suggest: SuggestItem[]) =>
  buildProviderWith(jest.fn().mockResolvedValue(suggest));

function buildPrisma(previous: unknown = null) {
  return {
    keyword: {
      findUnique: jest.fn().mockResolvedValue({
        text: 'puzzle game',
        store: Store.APP_STORE,
        country: 'us',
      }),
    },
    keywordMetric: { findFirst: jest.fn().mockResolvedValue(previous) },
  } as unknown as PrismaService;
}

function buildApp(overrides: Record<string, unknown> = {}) {
  return {
    store: Store.GOOGLE_PLAY,
    storeAppId: 'app0',
    title: 'Puzzle Game',
    description: '',
    ratingCount: 5000,
    ratingAvg: 4.3,
    installs: 1_000_000n,
    storeUpdatedAt: daysAgo(20),
    raw: {},
    ...overrides,
  };
}

function buildGplayProvider(
  overrides: { getApp?: jest.Mock; suggest?: jest.Mock } = {},
) {
  const search = jest.fn().mockResolvedValue(buildSearch());
  const getApp = overrides.getApp ?? jest.fn().mockResolvedValue(buildApp());
  const suggest = overrides.suggest ?? jest.fn().mockResolvedValue([]);
  const registry = {
    get: jest.fn().mockReturnValue({ search, getApp, suggest }),
  } as unknown as StoreProviderRegistry;
  return { registry, search, getApp, suggest };
}

function buildGplayPrisma() {
  return {
    keyword: {
      findUnique: jest.fn().mockResolvedValue({
        text: 'puzzle game',
        store: Store.GOOGLE_PLAY,
        country: 'us',
      }),
    },
    keywordMetric: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
}

describe('StatsCollectorService', () => {
  it('assembles stats from one search and the suggest probe', async () => {
    const { registry, search, suggestFn } = buildProvider([
      { term: 'puzzle game', priority: 7000 },
      { term: 'puzzle game free', priority: 9000 },
    ]);
    const service = new StatsCollectorService(buildPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(search).toHaveBeenCalledWith('puzzle game', 'us', 100);
    expect(suggestFn).toHaveBeenNthCalledWith(1, 'puzzle game', 'us');
    expect(suggestFn).toHaveBeenNthCalledWith(2, 'p', 'us');
    expect(search).toHaveBeenCalledTimes(1);
    expect(suggestFn).toHaveBeenCalledTimes(2);

    expect(collected?.stats.keywordText).toBe('puzzle game');
    expect(collected?.stats.top10).toHaveLength(10);
    expect(collected?.stats.top10[0].ratingCount).toBe(1000);
    expect(collected?.stats.top10[0].daysSinceUpdate).toBe(10);
    expect(collected?.stats.top30TitleMatchCount).toBe(12);
    expect(collected?.stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 1,
      position: 1,
    });
    expect(collected?.evidence).toEqual({
      searchResultCount: 40,
      suggestCompleted: true,
      suggestRequests: 2,
      prefixSweepCompleted: true,
      detailTargetCount: 10,
      detailSuccessCount: 10,
    });
  });

  it('probes suggest reach on the app store', async () => {
    const suggestFn = jest.fn((term: string) =>
      Promise.resolve(
        term === 'puzzle game' || term === 'puz'
          ? [{ term: 'puzzle game' }]
          : [],
      ),
    );
    const { registry } = buildProviderWith(suggestFn);
    const service = new StatsCollectorService(buildPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(collected?.stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 3,
      position: 1,
    });
    expect(collected?.stats.resultCount).toBe(40);
    expect(collected?.stats.top10[0]).toMatchObject({ storeAppId: 'app0' });
    expect(collected?.evidence).toMatchObject({
      suggestCompleted: true,
      suggestRequests: 4,
    });
  });

  it('returns null when the keyword no longer exists', async () => {
    const { registry, search, suggestFn } = buildProvider([]);
    const prisma = {
      keyword: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new StatsCollectorService(prisma, registry);

    expect(await service.collect('gone')).toBeNull();
    expect(search).not.toHaveBeenCalled();
    expect(suggestFn).not.toHaveBeenCalled();
  });

  it('scores without suggestions when the suggest request fails', async () => {
    const search = jest.fn().mockResolvedValue(buildSearch());
    const suggestFn = jest
      .fn()
      .mockRejectedValue(new Error('Suggest API response validation failed'));
    const registry = {
      get: jest.fn().mockReturnValue({ search, suggest: suggestFn }),
    } as unknown as StoreProviderRegistry;
    const service = new StatsCollectorService(buildPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(collected).not.toBeNull();
    expect(collected?.stats.suggest).toEqual({ status: 'unavailable' });
    expect(collected?.stats.top30TitleMatchCount).toBe(12);
    expect(collected?.evidence.suggestCompleted).toBe(false);
  });

  it('enriches the google play top10 via sequential getApp', async () => {
    const suggest = jest.fn().mockResolvedValue([{ term: 'puzzle game' }]);
    const { registry, search, getApp } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(buildGplayPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(search).toHaveBeenCalledWith('puzzle game', 'us', 100);
    expect(getApp).toHaveBeenCalledTimes(10);
    expect(collected?.stats.store).toBe('GOOGLE_PLAY');
    expect(collected?.stats.top10).toHaveLength(10);
    expect(collected?.stats.top10[0]).toEqual({
      storeAppId: 'app0',
      title: 'Puzzle Game',
      ratingCount: 5000,
      ratingAvg: 4.3,
      daysSinceUpdate: 20,
      installs: 1_000_000,
    });
    expect(collected?.stats.top30TitleMatchCount).toBe(12);
    expect(collected?.evidence).toEqual({
      searchResultCount: 40,
      suggestCompleted: true,
      suggestRequests: 2,
      prefixSweepCompleted: true,
      detailTargetCount: 10,
      detailSuccessCount: 10,
    });
  });

  it('drops a google play entry when its detail lookup fails', async () => {
    const getApp = jest
      .fn()
      .mockResolvedValue(buildApp())
      .mockRejectedValueOnce(new Error('detail failed'));
    const { registry } = buildGplayProvider({ getApp });
    const service = new StatsCollectorService(buildGplayPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(getApp).toHaveBeenCalledTimes(10);
    expect(collected?.stats.top10).toHaveLength(9);
    expect(collected?.evidence.detailTargetCount).toBe(10);
    expect(collected?.evidence.detailSuccessCount).toBe(9);
  });

  it('stops prefix probing at the first suggest hit', async () => {
    const suggest = jest
      .fn()
      .mockImplementation((prefix: string) =>
        Promise.resolve(prefix.length >= 2 ? [{ term: 'puzzle game' }] : []),
      );
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(buildGplayPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(suggest).toHaveBeenCalledTimes(3);
    expect(collected?.stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 2,
      position: 1,
    });
    expect(collected?.evidence.prefixSweepCompleted).toBe(true);
  });

  it('stops after one request when the store never suggests the keyword', async () => {
    const suggest = jest.fn().mockResolvedValue([]);
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(buildGplayPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(suggest).toHaveBeenCalledTimes(1);
    expect(collected?.stats.suggest).toEqual({ status: 'absent' });
    expect(collected?.evidence.prefixSweepCompleted).toBe(true);
  });

  it('scores on demand only when the google play suggest probe is unavailable', async () => {
    const suggest = jest.fn().mockRejectedValue(new Error('suggest failed'));
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(buildGplayPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(suggest).toHaveBeenCalledTimes(1);
    expect(collected?.stats.suggest).toEqual({ status: 'unavailable' });
    expect(collected?.evidence).toMatchObject({
      suggestCompleted: false,
      suggestRequests: 1,
    });
  });

  describe('previous scored page', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    const collectWith = async (previous: unknown) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-21T10:00:00Z'));
      const prisma = buildPrisma(previous);
      const service = new StatsCollectorService(
        prisma,
        buildProvider([]).registry,
      );
      const collected = await service.collect('kw1');
      return { prisma, collected };
    };

    it('reads the newest metric at least fourteen days old', async () => {
      const { prisma, collected } = await collectWith({
        date: new Date('2026-08-31T00:00:00Z'),
        stats: {
          top10: [
            { storeAppId: 'app0', ratingCount: 900 },
            { storeAppId: 'app1', ratingCount: Number.NaN },
            { title: 'no id', ratingCount: 5 },
            { storeAppId: 'app2', ratingCount: 950 },
          ],
        },
      });

      expect(prisma.keywordMetric.findFirst).toHaveBeenCalledWith({
        where: {
          keywordId: 'kw1',
          date: { lte: new Date('2026-09-07T00:00:00Z') },
        },
        orderBy: { date: 'desc' },
        select: { date: true, stats: true },
      });
      expect(collected?.stats.previousTop10).toEqual([
        { storeAppId: 'app0', ratingCount: 900 },
        { storeAppId: 'app2', ratingCount: 950 },
      ]);
      expect(collected?.stats.previousCapturedDaysAgo).toBe(21);
    });

    it.each([
      [
        'a v1 row',
        {
          date: new Date('2026-08-31T00:00:00Z'),
          stats: { top10: [{ title: 'Puzzle', ratingCount: 900 }] },
        },
      ],
      ['a row without a page', { date: new Date(), stats: null }],
      ['no row', null],
    ])('ignores %s', async (_name, previous) => {
      const { collected } = await collectWith(previous);
      expect(collected?.stats.previousTop10).toBeUndefined();
      expect(collected?.stats.previousCapturedDaysAgo).toBeUndefined();
    });
  });
});
