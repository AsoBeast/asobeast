import { Store } from '@prisma/client';
import { StoreSuggestionStrategy } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  StoreNotSupportedError,
  StoreRequestError,
} from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { listingLanguages } from './listing-languages';
import { CompetitorSearchPlanner } from './competitor-search.planner';
import { StoreSuggestions } from './store-suggestions';
import { SuggestionRequest } from './suggestion-request';

const requestFor = ({
  store = Store.APP_STORE,
  home = 'us',
  market = home,
  tracked = [],
}: {
  store?: Store;
  home?: string;
  market?: string;
  tracked?: string[];
} = {}): SuggestionRequest => ({
  appId: 'app1',
  limit: 30,
  tracked: new Set(tracked),
  market: { store, country: market, storeAppId: 'store1' },
  languages: {
    home: listingLanguages(store, home),
    market: listingLanguages(store, market),
  },
});

const unusedPlanner = {
  plan: jest.fn(),
} as unknown as CompetitorSearchPlanner;

const buildStore = (raw: unknown, registry: unknown, title = 'Habit Tracker') =>
  new StoreSuggestions(
    {
      appSnapshot: {
        findFirst: jest.fn().mockResolvedValue({ raw, title }),
      },
    } as unknown as PrismaService,
    registry as StoreProviderRegistry,
    unusedPlanner,
  );

const lookUp = async (
  store: StoreSuggestions,
  strategy: StoreSuggestionStrategy,
  request: SuggestionRequest,
) => (await (await store.plan(strategy, request))?.()) ?? [];

describe('StoreSuggestions.suggest developer', () => {
  it('counts title terms across the developer catalogue', async () => {
    const developerApps = jest.fn().mockResolvedValue([
      { storeAppId: '2', title: 'Habit Tracker' },
      { storeAppId: '3', title: 'Sleep Timer Pro' },
      { storeAppId: '4', title: 'Sleep Sounds' },
      { storeAppId: '5', title: 'Streak Counter' },
    ]);
    const registry = { get: jest.fn().mockReturnValue({ developerApps }) };
    const store = buildStore({ artistId: 284882218 }, registry);

    const suggestions = await lookUp(
      store,
      'developer',
      requestFor({ tracked: ['streak'] }),
    );

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
    const store = buildStore({ source: 'fixture' }, registry);

    await expect(
      lookUp(store, 'developer', requestFor({ tracked: ['streak'] })),
    ).resolves.toEqual([]);
    expect(developerApps).not.toHaveBeenCalled();
  });
});

describe('StoreSuggestions.suggest in a spanish market', () => {
  const wordsOf = (suggestions: { text: string }[]): string[] =>
    suggestions.flatMap(({ text }) => text.split(' '));

  it('counts the title terms of similar apps without their function words', async () => {
    const similar = jest.fn().mockResolvedValue([
      { storeAppId: '2', title: 'Juegos de Trivia' },
      { storeAppId: '3', title: 'Trivia para Todos' },
    ]);
    const store = buildStore(
      { artistId: 1 },
      { get: jest.fn().mockReturnValue({ similar }) },
    );

    const suggestions = await lookUp(
      store,
      'similar',
      requestFor({ home: 'mx' }),
    );

    expect(similar).toHaveBeenCalledWith('store1', 'mx');
    expect(suggestions.find(({ text }) => text === 'trivia')).toEqual(
      expect.objectContaining({ usedByCount: 2 }),
    );
    expect(wordsOf(suggestions)).not.toContain('de');
    expect(wordsOf(suggestions)).not.toContain('para');
  });

  it('reads the market asked for, not the home market, in a similar search', async () => {
    const similar = jest
      .fn()
      .mockResolvedValue([{ storeAppId: '2', title: 'Die Hard Quiz' }]);
    const store = buildStore(
      { artistId: 1 },
      { get: jest.fn().mockReturnValue({ similar }) },
    );

    const suggestions = await lookUp(
      store,
      'similar',
      requestFor({ home: 'mx', market: 'de' }),
    );

    expect(suggestions.map(({ text }) => text).sort()).toEqual([
      'hard',
      'hard quiz',
      'quiz',
    ]);
  });

  it('excludes the home title in its own language and reads developer titles in the market asked for', async () => {
    const developerApps = jest.fn().mockResolvedValue([
      { storeAppId: '2', title: 'Die Hard Quiz' },
      { storeAppId: '3', title: 'Juegos Trivia' },
    ]);
    const store = buildStore(
      { artistId: 1 },
      { get: jest.fn().mockReturnValue({ developerApps }) },
      'Preguntados: Juegos de Trivia',
    );

    const suggestions = await lookUp(
      store,
      'developer',
      requestFor({ home: 'mx', market: 'de' }),
    );

    expect(developerApps).toHaveBeenCalledWith('1', 'de');
    expect(suggestions.map(({ text }) => text).sort()).toEqual([
      'hard',
      'hard quiz',
      'quiz',
    ]);
  });
});

describe('StoreSuggestions.plan', () => {
  const trackedRows = (sources: string[]) =>
    sources.map((source, index) => ({
      source,
      keyword: { text: `seed ${index}`, country: 'us' },
    }));

  const buildPlanner = ({
    tracked = [],
    snapshot = null,
    provider = {},
    get,
  }: {
    tracked?: ReturnType<typeof trackedRows>;
    snapshot?: unknown;
    provider?: Record<string, jest.Mock>;
    get?: jest.Mock;
  } = {}) => {
    const prisma = {
      keywordField: { findMany: jest.fn().mockResolvedValue([]) },
      trackedKeyword: { findMany: jest.fn().mockResolvedValue(tracked) },
      appSnapshot: { findFirst: jest.fn().mockResolvedValue(snapshot) },
    };
    const registry = { get: get ?? jest.fn().mockReturnValue(provider) };
    return {
      prisma,
      registry,
      store: new StoreSuggestions(
        prisma as unknown as PrismaService,
        registry as unknown as StoreProviderRegistry,
        unusedPlanner,
      ),
    };
  };

  it('plans no lookup for search without a tracked keyword', async () => {
    const { store, registry } = buildPlanner();

    await expect(store.plan('search', requestFor())).resolves.toBeNull();
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('plans a lookup for search over the strongest seeds without asking the store', async () => {
    const suggest = jest.fn().mockResolvedValue([]);
    const { store, prisma } = buildPlanner({
      tracked: trackedRows([
        'SUGGESTED',
        'TITLE',
        'MANUAL',
        'COMPETITOR',
        'KEYWORD_FIELD',
        'SUBTITLE',
      ]),
      provider: { suggest },
    });

    const lookup = await store.plan('search', requestFor());

    expect(lookup).toEqual(expect.any(Function));
    expect(suggest).not.toHaveBeenCalled();
    prisma.trackedKeyword.findMany.mockClear();
    await lookup?.();
    expect(suggest.mock.calls.map(([seed]: [string]) => seed)).toEqual([
      'seed 4',
      'seed 1',
      'seed 2',
      'seed 5',
      'seed 0',
    ]);
    expect(prisma.trackedKeyword.findMany).not.toHaveBeenCalled();
  });

  it('search keeps the suggestions of the seeds that answered', async () => {
    const suggest = jest
      .fn()
      .mockResolvedValueOnce([{ term: 'first answer' }])
      .mockRejectedValueOnce(
        new StoreRequestError(Store.APP_STORE, 'suggest', 'timeout'),
      )
      .mockResolvedValueOnce([{ term: 'third answer' }]);
    const { store } = buildPlanner({
      tracked: trackedRows(['MANUAL', 'MANUAL', 'MANUAL']),
      provider: { suggest },
    });

    const lookup = await store.plan('search', requestFor());

    expect((await lookup?.())?.map((item) => item.text).sort()).toEqual([
      'first answer',
      'third answer',
    ]);
  });

  it('plans no lookup for developer without a developer id', async () => {
    const developerApps = jest.fn();
    for (const snapshot of [
      { raw: { source: 'fixture' }, title: 'Habit' },
      null,
    ]) {
      const { store } = buildPlanner({ snapshot, provider: { developerApps } });
      await expect(store.plan('developer', requestFor())).resolves.toBeNull();
    }
    expect(developerApps).not.toHaveBeenCalled();
  });

  it('plans a lookup for developer', async () => {
    const developerApps = jest.fn().mockResolvedValue([]);
    const { store, prisma } = buildPlanner({
      snapshot: { raw: { artistId: 284882218 }, title: 'Habit Tracker' },
      provider: { developerApps },
    });

    const lookup = await store.plan('developer', requestFor());

    expect(developerApps).not.toHaveBeenCalled();
    await lookup?.();
    expect(developerApps).toHaveBeenCalledWith('284882218', 'us');
    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledTimes(1);
  });

  it('plans a lookup for similar', async () => {
    const similar = jest.fn().mockResolvedValue([]);
    const { store } = buildPlanner({ provider: { similar } });

    const lookup = await store.plan('similar', requestFor());

    expect(similar).not.toHaveBeenCalled();
    await lookup?.();
    expect(similar).toHaveBeenCalledWith('store1', 'us');
  });

  it('delegates competitorSearch to its planner', async () => {
    const lookup = jest.fn();
    const plan = jest.fn().mockResolvedValue(lookup);
    const store = new StoreSuggestions(
      {} as PrismaService,
      {} as StoreProviderRegistry,
      { plan } as unknown as CompetitorSearchPlanner,
    );
    const request = requestFor();

    await expect(store.plan('competitorSearch', request)).resolves.toBe(lookup);
    expect(plan).toHaveBeenCalledWith(request);
  });

  it('refuses an unsupported store before any lookup', async () => {
    const { store } = buildPlanner({
      get: jest.fn(() => {
        throw new StoreNotSupportedError(Store.APP_STORE);
      }),
    });

    await expect(store.plan('similar', requestFor())).rejects.toBeInstanceOf(
      StoreNotSupportedError,
    );
  });
});
