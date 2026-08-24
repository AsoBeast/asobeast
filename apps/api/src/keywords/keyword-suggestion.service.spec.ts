import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { KeywordSuggestionService } from './keyword-suggestion.service';

const passThroughEgress = {
  through: <T>(_store: unknown, _country: unknown, work: () => Promise<T>) =>
    work(),
} as unknown as ProxyEgress;

describe('KeywordSuggestionService.suggest competitors', () => {
  const buildService = (prisma: unknown) =>
    new KeywordSuggestionService(
      prisma as PrismaService,
      undefined as unknown as StoreProviderRegistry,
      passThroughEgress,
    );

  it('counts overlapping competitor terms and drops tracked ones', async () => {
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app1',
          store: Store.APP_STORE,
          country: 'us',
          storeAppId: 'store1',
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            snapshots: [{ title: 'Habit Tracker', subtitle: 'Daily goals' }],
          },
          {
            snapshots: [{ title: 'Habit Planner', subtitle: 'Daily streak' }],
          },
        ]),
      },
      trackedKeyword: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ keyword: { text: 'streak' } }]),
      },
    };
    const service = buildService(prisma);

    const suggestions = await service.suggest('app1', 'competitors', 30);

    const byText = new Map(suggestions.map((s) => [s.text, s.usedByCount]));
    expect(byText.get('habit')).toBe(2);
    expect(byText.get('daily')).toBe(2);
    expect(byText.has('streak')).toBe(false);
    expect(suggestions.every((s) => s.strategy === 'competitors')).toBe(true);
    expect(suggestions[0].usedByCount).toBeGreaterThanOrEqual(
      suggestions[suggestions.length - 1].usedByCount ?? 0,
    );
  });
});

describe('KeywordSuggestionService.suggest developer', () => {
  const buildService = (prisma: unknown, registry: unknown) =>
    new KeywordSuggestionService(
      prisma as PrismaService,
      registry as StoreProviderRegistry,
      passThroughEgress,
    );

  const buildPrisma = (raw: unknown) => ({
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        store: Store.APP_STORE,
        country: 'us',
        storeAppId: 'store1',
      }),
    },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue({ raw, title: 'Habit Tracker' }),
    },
    trackedKeyword: {
      findMany: jest.fn().mockResolvedValue([{ keyword: { text: 'streak' } }]),
    },
  });

  it('counts title terms across the developer catalogue', async () => {
    const developerApps = jest.fn().mockResolvedValue([
      { storeAppId: '2', title: 'Habit Tracker' },
      { storeAppId: '3', title: 'Sleep Timer Pro' },
      { storeAppId: '4', title: 'Sleep Sounds' },
      { storeAppId: '5', title: 'Streak Counter' },
    ]);
    const registry = { get: jest.fn().mockReturnValue({ developerApps }) };
    const service = buildService(
      buildPrisma({ artistId: 284882218 }),
      registry,
    );

    const suggestions = await service.suggest('app1', 'developer', 30);

    expect(developerApps).toHaveBeenCalledWith('284882218', 'us');
    const byText = new Map(suggestions.map((s) => [s.text, s.usedByCount]));
    expect(byText.get('sleep')).toBe(2);
    expect(byText.has('streak')).toBe(false);
    expect(byText.has('habit')).toBe(false);
    expect(byText.has('tracker')).toBe(false);
    expect(suggestions.every((s) => s.strategy === 'developer')).toBe(true);
  });

  it('returns nothing when the snapshot carries no developer id', async () => {
    const developerApps = jest.fn();
    const registry = { get: jest.fn().mockReturnValue({ developerApps }) };
    const service = buildService(buildPrisma({ source: 'fixture' }), registry);

    await expect(service.suggest('app1', 'developer', 30)).resolves.toEqual([]);
    expect(developerApps).not.toHaveBeenCalled();
  });
});

describe('KeywordSuggestionService.suggest egress', () => {
  const buildPrisma = () => ({
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        store: Store.APP_STORE,
        country: 'us',
        storeAppId: 'store1',
        raw: {},
        title: 'Habit Tracker',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    appSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
    review: { findMany: jest.fn().mockResolvedValue([]) },
  });

  const buildService = (through: jest.Mock, registry: unknown) =>
    new KeywordSuggestionService(
      buildPrisma() as unknown as PrismaService,
      registry as StoreProviderRegistry,
      { through } as unknown as ProxyEgress,
    );

  it.each(['metadata', 'competitors', 'seasonal', 'reviews'] as const)(
    'answers %s without leasing a proxy endpoint',
    async (strategy) => {
      const through = jest.fn();
      const service = buildService(through, {
        get: jest.fn(() => {
          throw new Error('a local strategy must not reach the store');
        }),
      });

      await service.suggest('app1', strategy, 30);

      expect(through).not.toHaveBeenCalled();
    },
  );

  it.each(['search', 'similar', 'developer'] as const)(
    'leases a proxy endpoint for %s',
    async (strategy) => {
      const through = jest
        .fn()
        .mockImplementation(
          (_store: unknown, _country: unknown, work: () => Promise<unknown>) =>
            work(),
        );
      const service = buildService(through, {
        get: jest.fn().mockReturnValue({
          search: jest.fn().mockResolvedValue([]),
          suggest: jest.fn().mockResolvedValue([]),
          similar: jest.fn().mockResolvedValue([]),
          developerApps: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.suggest('app1', strategy, 30);

      expect(through).toHaveBeenCalledWith(
        Store.APP_STORE,
        'us',
        expect.any(Function),
      );
    },
  );
});
