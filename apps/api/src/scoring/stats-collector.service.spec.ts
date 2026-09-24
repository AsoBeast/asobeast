import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem, SuggestItem } from '../store-providers/types';
import { OfficialPopularityLookup } from './official-popularity';
import { MODEL_DEPTH } from './popularity-model';
import { StatsCollectorService } from './stats-collector.service';

const noOfficial = {
  for: jest.fn().mockResolvedValue(undefined),
} as unknown as OfficialPopularityLookup;

const daysAgo = (days: number): Date =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function buildSearch(): SearchItem[] {
  return Array.from({ length: 40 }, (_, index) => ({
    storeAppId: `app${index}`,
    title: index < 12 ? `Puzzle Game ${index}` : `Other App ${index}`,
    ratingCount: 1000 + index,
    ratingAvg: 4.5,
    genreId: '6014',
    releasedAt: daysAgo(730),
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

function buildPrisma() {
  return {
    keyword: {
      findUnique: jest.fn().mockResolvedValue({
        text: 'puzzle game',
        store: Store.APP_STORE,
        country: 'us',
      }),
    },
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
  } as unknown as PrismaService;
}

describe('StatsCollectorService', () => {
  it('assembles stats from one search and the suggest probe', async () => {
    const { registry, search, suggestFn } = buildProvider([
      { term: 'puzzle game', priority: 7000 },
      { term: 'puzzle game free', priority: 9000 },
    ]);
    const service = new StatsCollectorService(
      buildPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(search).toHaveBeenCalledWith('puzzle game', 'us', 100);
    expect(suggestFn).toHaveBeenNthCalledWith(1, 'puzzle game', 'us');
    expect(suggestFn).toHaveBeenNthCalledWith(2, 'p', 'us');
    expect(search).toHaveBeenCalledTimes(1);
    expect(suggestFn).toHaveBeenCalledTimes(2);

    expect(collected?.stats.keywordText).toBe('puzzle game');
    expect(Object.keys(collected?.stats ?? {}).sort()).toEqual([
      'keywordText',
      'resultCount',
      'serp',
      'store',
      'suggest',
    ]);
    expect(collected?.stats.serp).toHaveLength(MODEL_DEPTH);
    expect(collected?.stats.serp[0]).toEqual({
      storeAppId: 'app0',
      title: 'Puzzle Game 0',
      ratingCount: 1000,
      ratingAvg: 4.5,
      daysSinceRelease: 730,
    });
    expect(collected?.stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 1,
      position: 1,
    });
    expect(collected?.evidence).toEqual({
      searchResultCount: 40,
      suggestCompleted: true,
      suggestRequests: 2,
      detailTargetCount: 10,
      detailSuccessCount: 10,
      officialPopularityUsed: false,
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
    const service = new StatsCollectorService(
      buildPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(collected?.stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 3,
      position: 1,
    });
    expect(collected?.stats.resultCount).toBe(40);
    expect(collected?.stats.serp[0]).toMatchObject({ storeAppId: 'app0' });
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
    const service = new StatsCollectorService(prisma, registry, noOfficial);

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
    const service = new StatsCollectorService(
      buildPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(collected).not.toBeNull();
    expect(collected?.stats.suggest).toEqual({ status: 'unavailable' });
    expect(collected?.evidence.suggestCompleted).toBe(false);
  });

  it('enriches the google play top10 via sequential getApp', async () => {
    const suggest = jest.fn().mockResolvedValue([{ term: 'puzzle game' }]);
    const { registry, search, getApp } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(
      buildGplayPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(search).toHaveBeenCalledWith('puzzle game', 'us', 100);
    expect(getApp).toHaveBeenCalledTimes(10);
    expect(collected?.stats.store).toBe('GOOGLE_PLAY');
    expect(collected?.stats.serp).toHaveLength(10);
    expect(collected?.stats.serp[0]).toEqual({
      storeAppId: 'app0',
      title: 'Puzzle Game',
      ratingCount: 5000,
      ratingAvg: 4.3,
    });
    expect(collected?.evidence).toEqual({
      searchResultCount: 40,
      suggestCompleted: true,
      suggestRequests: 2,
      detailTargetCount: 10,
      detailSuccessCount: 10,
      officialPopularityUsed: false,
    });
  });

  it('keeps a google play entry in place when its detail lookup fails', async () => {
    const getApp = jest
      .fn()
      .mockResolvedValue(buildApp())
      .mockRejectedValueOnce(new Error('detail failed'));
    const { registry } = buildGplayProvider({ getApp });
    const service = new StatsCollectorService(
      buildGplayPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(getApp).toHaveBeenCalledTimes(10);
    expect(collected?.stats.serp).toHaveLength(10);
    expect(collected?.stats.serp[0]).toMatchObject({
      storeAppId: 'app0',
      title: 'Puzzle Game 0',
    });
    expect(collected?.evidence.detailTargetCount).toBe(10);
    expect(collected?.evidence.detailSuccessCount).toBe(9);
  });

  it('refuses to score when most google play detail lookups fail', async () => {
    const getApp = jest.fn().mockRejectedValue(new Error('rate limited'));
    const { registry } = buildGplayProvider({ getApp });
    const service = new StatsCollectorService(
      buildGplayPrisma(),
      registry,
      noOfficial,
    );

    await expect(service.collect('kw1')).rejects.toThrow(
      'only 0 of 10 detail lookups succeeded',
    );
  });

  it('stops prefix probing at the first suggest hit', async () => {
    const suggest = jest
      .fn()
      .mockImplementation((prefix: string) =>
        Promise.resolve(prefix.length >= 2 ? [{ term: 'puzzle game' }] : []),
      );
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(
      buildGplayPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(suggest).toHaveBeenCalledTimes(3);
    expect(collected?.stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 2,
      position: 1,
    });
  });

  it('stops after one request when the store never suggests the keyword', async () => {
    const suggest = jest.fn().mockResolvedValue([]);
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(
      buildGplayPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(suggest).toHaveBeenCalledTimes(1);
    expect(collected?.stats.suggest).toEqual({ status: 'absent' });
  });

  it('scores on demand only when the google play suggest probe is unavailable', async () => {
    const suggest = jest.fn().mockRejectedValue(new Error('suggest failed'));
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(
      buildGplayPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(suggest).toHaveBeenCalledTimes(1);
    expect(collected?.stats.suggest).toEqual({ status: 'unavailable' });
    expect(collected?.evidence).toMatchObject({
      suggestCompleted: false,
      suggestRequests: 1,
    });
  });

  it('carries an official popularity and says it was used', async () => {
    const lookup = jest.fn().mockResolvedValue({ value: 71 });
    const service = new StatsCollectorService(
      buildPrisma(),
      buildProvider([]).registry,
      { for: lookup } as unknown as OfficialPopularityLookup,
    );

    const collected = await service.collect('kw1');

    expect(lookup).toHaveBeenCalledWith(
      { text: 'puzzle game', store: Store.APP_STORE, country: 'us' },
      'GAMES',
    );
    expect(collected?.stats.official).toEqual({ value: 71 });
    expect(collected?.evidence.officialPopularityUsed).toBe(true);
  });

  it('caps without claiming the official source', async () => {
    const official = {
      for: jest.fn().mockResolvedValue({ absentBelow: 41 }),
    } as unknown as OfficialPopularityLookup;
    const service = new StatsCollectorService(
      buildPrisma(),
      buildProvider([]).registry,
      official,
    );

    const collected = await service.collect('kw1');

    expect(collected?.stats.official).toEqual({ absentBelow: 41 });
    expect(collected?.evidence.officialPopularityUsed).toBe(false);
  });

  it('reads google play completions of the keyword as reach', async () => {
    const suggest = jest.fn((term: string) =>
      Promise.resolve(
        term === 'puzzle game' || term === 'pu'
          ? [{ term: 'puzzle games' }, { term: 'puzzle game offline' }]
          : [{ term: 'pinterest' }],
      ),
    );
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(
      buildGplayPrisma(),
      registry,
      noOfficial,
    );

    const collected = await service.collect('kw1');

    expect(collected?.stats.suggest).toEqual({
      status: 'hit',
      prefixLength: 2,
      position: 1,
    });
  });
});
