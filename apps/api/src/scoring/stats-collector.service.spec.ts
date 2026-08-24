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

function buildProvider(suggest: SuggestItem[]) {
  const search = jest.fn().mockResolvedValue(buildSearch());
  const suggestFn = jest.fn().mockResolvedValue(suggest);
  const registry = {
    get: jest.fn().mockReturnValue({ search, suggest: suggestFn }),
  } as unknown as StoreProviderRegistry;
  return { registry, search, suggestFn };
}

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
  it('assembles stats from two provider requests', async () => {
    const { registry, search, suggestFn } = buildProvider([
      { term: 'puzzle game', priority: 7000 },
      { term: 'puzzle game free', priority: 9000 },
    ]);
    const service = new StatsCollectorService(buildPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(search).toHaveBeenCalledWith('puzzle game', 'us', 100);
    expect(suggestFn).toHaveBeenCalledWith('puzzle game', 'us');
    expect(search).toHaveBeenCalledTimes(1);
    expect(suggestFn).toHaveBeenCalledTimes(1);

    expect(collected?.stats.keywordText).toBe('puzzle game');
    expect(collected?.stats.top10).toHaveLength(10);
    expect(collected?.stats.top10[0].ratingCount).toBe(1000);
    expect(collected?.stats.top10[0].daysSinceUpdate).toBe(10);
    expect(collected?.stats.top30TitleMatchCount).toBe(12);
    expect(collected?.stats.suggest).toEqual({ priority: 7000 });
    expect(collected?.evidence).toEqual({
      searchResultCount: 40,
      suggestCompleted: true,
      prefixSweepCompleted: false,
      detailTargetCount: 0,
      detailSuccessCount: 0,
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
    expect(collected?.stats.suggest).toEqual({});
    expect(collected?.stats.top30TitleMatchCount).toBe(12);
    expect(collected?.evidence.suggestCompleted).toBe(false);
  });

  it('falls back to best partial priority when the term is absent', async () => {
    const { registry } = buildProvider([
      { term: 'puzzle game free', priority: 4000 },
      { term: 'puzzle game offline', priority: 6000 },
    ]);
    const service = new StatsCollectorService(buildPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(collected?.stats.suggest).toEqual({ partialPriority: 6000 });
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
      title: 'Puzzle Game',
      ratingCount: 5000,
      ratingAvg: 4.3,
      daysSinceUpdate: 20,
      installs: 1_000_000,
    });
    expect(collected?.stats.top30TitleMatchCount).toBe(12);
    expect(collected?.evidence).toEqual({
      searchResultCount: 40,
      suggestCompleted: false,
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

    expect(suggest).toHaveBeenCalledTimes(2);
    expect(collected?.stats.suggest).toEqual({ prefixHitLength: 2 });
    expect(collected?.evidence.prefixSweepCompleted).toBe(true);
  });

  it('caps prefix probing at seven and reports no hit', async () => {
    const suggest = jest.fn().mockResolvedValue([]);
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(buildGplayPrisma(), registry);

    const collected = await service.collect('kw1');

    expect(suggest).toHaveBeenCalledTimes(7);
    expect(collected?.stats.suggest).toEqual({ prefixHitLength: null });
    expect(collected?.evidence.prefixSweepCompleted).toBe(true);
  });

  it('fails the job when the google play prefix sweep is unavailable', async () => {
    const suggest = jest.fn().mockRejectedValue(new Error('suggest failed'));
    const { registry } = buildGplayProvider({ suggest });
    const service = new StatsCollectorService(buildGplayPrisma(), registry);

    await expect(service.collect('kw1')).rejects.toThrow('suggest failed');
    expect(suggest).toHaveBeenCalledTimes(1);
  });
});
