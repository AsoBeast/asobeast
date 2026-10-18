import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { listingLanguages } from './listing-languages';
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

const buildStore = (raw: unknown, registry: unknown, title = 'Habit Tracker') =>
  new StoreSuggestions(
    {
      appSnapshot: {
        findFirst: jest.fn().mockResolvedValue({ raw, title }),
      },
    } as unknown as PrismaService,
    registry as StoreProviderRegistry,
  );

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

    const suggestions = await store.suggest(
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
      store.suggest('developer', requestFor({ tracked: ['streak'] })),
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

    const suggestions = await store.suggest(
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

    const suggestions = await store.suggest(
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

    const suggestions = await store.suggest(
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
