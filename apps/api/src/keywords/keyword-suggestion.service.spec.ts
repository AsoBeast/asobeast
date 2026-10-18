import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { KeywordSuggestionService } from './keyword-suggestion.service';
import { StoreSuggestions } from './store-suggestions';

const buildSuggestionService = (
  prisma: unknown,
  registry: unknown,
  egress: ProxyEgress,
) =>
  new KeywordSuggestionService(
    prisma as PrismaService,
    new StoreSuggestions(
      prisma as PrismaService,
      registry as StoreProviderRegistry,
    ),
    egress,
  );

const passThroughEgress = {
  through: <T>(_store: unknown, _country: unknown, work: () => Promise<T>) =>
    work(),
} as unknown as ProxyEgress;

describe('KeywordSuggestionService.suggest competitors', () => {
  const buildService = (prisma: unknown) =>
    buildSuggestionService(prisma, undefined, passThroughEgress);

  it('counts overlapping competitor terms and drops tracked ones', async () => {
    const prisma = {
      keywordField: { findMany: jest.fn().mockResolvedValue([]) },
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

describe('KeywordSuggestionService.suggest egress', () => {
  const buildPrisma = () => ({
    keywordField: { findMany: jest.fn().mockResolvedValue([]) },
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
    buildSuggestionService(buildPrisma(), registry, {
      through,
    } as unknown as ProxyEgress);

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

describe('KeywordSuggestionService.suggest in a spanish market', () => {
  const buildPrisma = (store: Store) => ({
    keywordField: { findMany: jest.fn().mockResolvedValue([]) },
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        store,
        country: 'mx',
        storeAppId: 'store1',
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          snapshots: [
            { title: 'Mi Banco', subtitle: 'Tus finanzas en el móvil' },
          ],
        },
        {
          snapshots: [
            { title: 'Otro Banco', subtitle: 'Finanzas en tu móvil' },
          ],
        },
      ]),
    },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue({
        title: 'Preguntados: Juegos de Trivia',
        subtitle: null,
        summary: 'Quiz de preguntas para amigos',
        raw: { artistId: 1 },
      }),
    },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
  });

  const buildService = (prisma: unknown, registry: unknown = undefined) =>
    buildSuggestionService(prisma, registry, passThroughEgress);

  const wordsOf = (suggestions: { text: string }[]): string[] =>
    suggestions.flatMap(({ text }) => text.split(' '));

  it('suggests the words of the listing without its function words', async () => {
    const service = buildService(buildPrisma(Store.GOOGLE_PLAY));

    const suggestions = await service.suggest('app1', 'metadata', 30);

    expect(suggestions.map(({ text }) => text)).toEqual(
      expect.arrayContaining(['juegos trivia', 'quiz preguntas amigos']),
    );
    expect(
      wordsOf(suggestions).filter((word) => ['de', 'para'].includes(word)),
    ).toEqual([]);
  });

  it('counts competitor terms without their function words', async () => {
    const service = buildService(buildPrisma(Store.APP_STORE));

    const suggestions = await service.suggest('app1', 'competitors', 30);

    expect(suggestions.find(({ text }) => text === 'finanzas móvil')).toEqual(
      expect.objectContaining({ usedByCount: 2 }),
    );
    expect(
      wordsOf(suggestions).filter((word) =>
        ['en', 'el', 'tu', 'tus'].includes(word),
      ),
    ).toEqual([]);
  });
});

describe('KeywordSuggestionService.suggest seasonal', () => {
  const buildService = (country: string, store: Store) =>
    buildSuggestionService(
      {
        keywordField: { findMany: jest.fn().mockResolvedValue([]) },
        app: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'app1',
            store,
            country,
            storeAppId: 'store1',
          }),
        },
        trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
      },
      undefined,
      passThroughEgress,
    );

  const textsOn = async (
    isoDate: string,
    home: { country: string; store?: Store },
    queryCountry?: string,
  ): Promise<string[]> => {
    jest.useFakeTimers().setSystemTime(new Date(`${isoDate}T12:00:00.000Z`));
    const suggestions = await buildService(
      home.country,
      home.store ?? Store.APP_STORE,
    ).suggest('app1', 'seasonal', 30, queryCountry);
    return suggestions.map((suggestion) => suggestion.text);
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('names the coming year in the end of year goals keyword', async () => {
    const texts = await textsOn('2027-12-20', { country: 'us' });

    expect(texts).toContain('goals 2028');
    expect(texts).not.toContain('goals 2026');
  });

  it('offers no Halloween keywords to a Google Play app in South Korea', async () => {
    await expect(
      textsOn('2026-10-09', { country: 'kr', store: Store.GOOGLE_PLAY }),
    ).resolves.toEqual([]);
  });

  it('judges the storefront of the country query, not the home storefront', async () => {
    await expect(
      textsOn('2026-10-09', { country: 'kr' }, 'us'),
    ).resolves.toContain('halloween');
    await expect(
      textsOn('2026-10-09', { country: 'us' }, 'kr'),
    ).resolves.toEqual([]);
  });

  it('offers Halloween keywords in an English storefront that observes it', async () => {
    await expect(textsOn('2026-10-09', { country: 'gb' })).resolves.toEqual(
      expect.arrayContaining(['halloween', 'scary']),
    );
  });
});

describe('KeywordSuggestionService.suggest allowance', () => {
  const buildPrisma = () => ({
    keywordField: { findMany: jest.fn().mockResolvedValue([]) },
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        store: Store.APP_STORE,
        country: 'us',
        storeAppId: 'store1',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue({ raw: {}, title: 'Habit' }),
    },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
  });

  const buildService = (order: string[]) => {
    const through = jest.fn(
      <T>(_store: unknown, _country: unknown, work: () => Promise<T>) => {
        order.push('store');
        return work();
      },
    );
    const service = buildSuggestionService(
      buildPrisma(),
      { get: () => ({ similar: jest.fn().mockResolvedValue([]) }) },
      { through } as unknown as ProxyEgress,
    );
    return { service, through };
  };

  it('calls spend before a store strategy reaches the provider', async () => {
    const order: string[] = [];
    const { service } = buildService(order);
    const spend = jest.fn(() => {
      order.push('spend');
      return Promise.resolve();
    });

    await service.suggest('app1', 'similar', 30, undefined, spend);

    expect(order).toEqual(['spend', 'store']);
  });

  it('never calls spend for a database strategy', async () => {
    const { service, through } = buildService([]);
    const spend = jest.fn().mockResolvedValue(undefined);

    await service.suggest('app1', 'competitors', 30, undefined, spend);

    expect(spend).not.toHaveBeenCalled();
    expect(through).not.toHaveBeenCalled();
  });
});
