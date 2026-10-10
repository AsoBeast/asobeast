import { Store } from '@prisma/client';
import { AppStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { StoreRequestError } from './errors';
import { storeDeadline, withinStoreDeadline } from './store-deadline';

const makeLib = (overrides: Partial<AppStoreLib> = {}): AppStoreLib => ({
  app: jest.fn(),
  page: jest.fn().mockResolvedValue('<h1>App</h1>'),
  search: jest.fn(),
  suggest: jest.fn(),
  similar: jest.fn(),
  list: jest.fn(),
  reviews: jest.fn(),
  developer: jest.fn(),
  ...overrides,
});

describe('AppStoreProvider', () => {
  it('maps app fields and stringifies numeric ids', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 553834731,
      title: 'Candy Crush',
      description: 'A game',
      icon: 'https://icon',
      score: 4.5,
      reviews: 1000,
      price: 0,
      version: '1.2.3',
      released: '2010-01-01T00:00:00Z',
      updated: '2024-06-01T00:00:00Z',
    });
    const provider = new AppStoreProvider(makeLib({ app }));

    const result = await provider.getApp('553834731', 'us');

    expect(result.storeAppId).toBe('553834731');
    expect(typeof result.storeAppId).toBe('string');
    expect(result.store).toBe(Store.APP_STORE);
    expect(result.subtitle).toBeUndefined();
    expect(result.ratingAvg).toBe(4.5);
    expect(result.ratingCount).toBe(1000);
    expect(result.iconUrl).toBe('https://icon');
    expect(result.releasedAt).toEqual(new Date('2010-01-01T00:00:00Z'));
    expect(result.storeUpdatedAt).toEqual(new Date('2024-06-01T00:00:00Z'));
    expect(result.raw).toBeDefined();
    expect(app).toHaveBeenCalledWith({
      id: 553834731,
      country: 'us',
      ratings: true,
    });
  });

  const IPAD_ONLY_DEVICES = [
    'iPadAir-iPadAir',
    'iPadProCellular-iPadProCellular',
    'iPadPro13M4-iPadPro13M4',
  ];

  it.each([
    ['a Mac only app such as Xcode', [], false],
    ['an Apple TV only app', ['AppleTV4-AppleTV4'], false],
    ['a universal app', ['iPhone15-iPhone15', 'iPadAir5-iPadAir5'], true],
    [
      'an iPhone only app that lists the iPads it runs on',
      ['iPhone5s-iPhone5s', 'iPadAir-iPadAir'],
      true,
    ],
    ['an iPad only app such as Procreate', IPAD_ONLY_DEVICES, false],
    [
      'an iPad only app that also runs on the Mac',
      [...IPAD_ONLY_DEVICES, 'MacDesktop-MacDesktop'],
      false,
    ],
    ['an iPod touch app', ['iPodTouchSeventhGen-iPodTouchSeventhGen'], true],
    ['a listing that reports no devices at all', undefined, true],
  ])(
    'knows whether %s is listed in the iPhone search it reads',
    async (_, supportedDevices, searchable) => {
      const app = jest.fn().mockResolvedValue({
        id: 497799835,
        title: 'Xcode',
        subtitle: 'Build apps',
        description: 'desc',
        supportedDevices,
      });
      const provider = new AppStoreProvider(makeLib({ app }));

      const result = await provider.getApp('497799835', 'us');

      expect(result.searchable).toBe(searchable);
    },
  );

  it('maps subtitle when present on the lookup payload', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 1,
      title: 'App',
      subtitle: 'The best app',
      description: 'desc',
    });
    const page = jest.fn();
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('1', 'us');

    expect(result.subtitle).toBe('The best app');
    expect(page).not.toHaveBeenCalled();
  });

  it('scrapes subtitle from the product page when the lookup omits it', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 1,
      title: 'App',
      description: 'desc',
    });
    const page = jest
      .fn()
      .mockResolvedValue(
        '<h1>App</h1><p class="subtitle svelte-abc123">Crossword Puzzles Brain Games</p>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('1', 'us');

    expect(result.subtitle).toBe('Crossword Puzzles Brain Games');
    expect(page).toHaveBeenCalledWith({ id: 1, country: 'us' });
  });

  it('reads no subtitle when the product page renders the primary category in its place', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 984380185,
      title: 'Vipps',
      description: 'desc',
      genres: ['Finance', 'Utilities'],
    });
    const page = jest
      .fn()
      .mockResolvedValue(
        '<h1>Vipps</h1><p class="subtitle svelte-kps97o">Finance</p>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('984380185', 'no');

    expect(result.subtitle).toBeUndefined();
    expect(result.subtitleUnavailable).toBe(false);
  });

  it('reads no subtitle when a game page prints its subgenre in the subtitle slot', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 549027629,
      title: 'Super Hexagon',
      description: 'desc',
      genres: ['Games', 'Action', 'Casual'],
    });
    const page = jest
      .fn()
      .mockResolvedValue(
        '<h1>Super Hexagon</h1><p class="subtitle svelte-kps97o">Action</p>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('549027629', 'us');

    expect(result.subtitle).toBeUndefined();
    expect(result.subtitleUnavailable).toBe(false);
  });

  it('keeps the real subtitle of a game', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 728293409,
      title: 'Monument Valley',
      description: 'desc',
      genres: ['Games', 'Puzzle', 'Entertainment', 'Adventure'],
    });
    const page = jest
      .fn()
      .mockResolvedValue(
        '<h1>Monument Valley</h1><p class="subtitle svelte-kps97o">A Quest for Forgiveness</p>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('728293409', 'us');

    expect(result.subtitle).toBe('A Quest for Forgiveness');
  });

  it('leaves subtitle undefined when the product page has none', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 1,
      title: 'App',
      description: 'desc',
    });
    const page = jest.fn().mockResolvedValue('<h1>App</h1>');
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('1', 'us');

    expect(result.subtitle).toBeUndefined();
  });

  it('marks the subtitle unavailable when the product page stays throttled', async () => {
    jest.useFakeTimers();
    const app = jest.fn().mockResolvedValue({
      id: 6473753684,
      title: 'Claude',
      description: 'desc',
    });
    const page = jest
      .fn()
      .mockRejectedValue(new Error('Request failed with status 429'));
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const promise = provider.getApp('6473753684', 'pl');
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.subtitle).toBeUndefined();
    expect(result.subtitleUnavailable).toBe(true);
    expect(page).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('marks the subtitle unavailable when the product page renders no listing', async () => {
    jest.useFakeTimers();
    const app = jest
      .fn()
      .mockResolvedValue({ id: 1, title: 'App', description: 'desc' });
    const page = jest
      .fn()
      .mockResolvedValue(
        '<!DOCTYPE html><html><body><div class="body-container"></div></body></html>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const promise = provider.getApp('1', 'us');
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.subtitleUnavailable).toBe(true);
    expect(page).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('reads the subtitle once a throttled product page answers', async () => {
    jest.useFakeTimers();
    const app = jest
      .fn()
      .mockResolvedValue({ id: 1, title: 'App', description: 'desc' });
    const page = jest
      .fn()
      .mockRejectedValueOnce(new Error('Request failed with status 429'))
      .mockResolvedValue(
        '<h1>App</h1><p class="subtitle svelte-kps97o">AI assistant for life and work</p>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const promise = provider.getApp('1', 'pl');
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.subtitle).toBe('AI assistant for life and work');
    expect(result.subtitleUnavailable).toBe(false);
    jest.useRealTimers();
  });

  it('confirms a rendered listing that has no subtitle', async () => {
    const app = jest
      .fn()
      .mockResolvedValue({ id: 1, title: 'App', description: 'desc' });
    const page = jest.fn().mockResolvedValue('<h1>App</h1>');
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('1', 'us');

    expect(result.subtitle).toBeUndefined();
    expect(result.subtitleUnavailable).toBe(false);
  });

  it('falls back to currentVersionReviews for the rating count', async () => {
    const app = jest.fn().mockResolvedValue({
      id: 1,
      title: 'App',
      description: 'desc',
      currentVersionReviews: 42,
    });
    const provider = new AppStoreProvider(makeLib({ app }));

    const result = await provider.getApp('1', 'us');

    expect(result.ratingCount).toBe(42);
  });

  it('maps search items including updatedAt', async () => {
    const search = jest.fn().mockResolvedValue([
      {
        id: 42,
        title: 'Result',
        developer: 'Dev Co',
        score: 4,
        reviews: 10,
        updated: '2024-05-01T00:00:00Z',
      },
    ]);
    const provider = new AppStoreProvider(makeLib({ search }));

    const items = await provider.search('puzzle', 'us', 5);

    expect(items[0]).toEqual({
      storeAppId: '42',
      title: 'Result',
      developer: 'Dev Co',
      ratingAvg: 4,
      ratingCount: 10,
      updatedAt: new Date('2024-05-01T00:00:00Z'),
    });
    expect(search).toHaveBeenCalledWith({
      term: 'puzzle',
      country: 'us',
      num: 5,
    });
  });

  it('preserves suggest priority untouched', async () => {
    const suggest = jest
      .fn()
      .mockResolvedValue([
        { term: 'minecraft', priority: 8000 },
        { term: 'mine' },
      ]);
    const provider = new AppStoreProvider(makeLib({ suggest }));

    const suggestions = await provider.suggest('min', 'us');

    expect(suggestions).toEqual([
      { term: 'minecraft', priority: 8000 },
      { term: 'mine', priority: undefined },
    ]);
  });

  it('maps similar apps like search results', async () => {
    const similar = jest
      .fn()
      .mockResolvedValue([{ id: 7, title: 'Similar', developer: 'Dev' }]);
    const provider = new AppStoreProvider(makeLib({ similar }));

    const items = await provider.similar('1', 'us');

    expect(items[0].storeAppId).toBe('7');
    expect(similar).toHaveBeenCalledWith({ id: 1, country: 'us' });
  });

  it('maps the collection union, passes the genre, and preserves order', async () => {
    const list = jest.fn().mockResolvedValue([
      { id: 111, appId: 'com.a', title: 'First' },
      { id: 222, appId: 'com.b', title: 'Second' },
    ]);
    const provider = new AppStoreProvider(makeLib({ list }));

    const items = await provider.topCharts('paid', '6007', 200, 'us');

    expect(items).toEqual([
      { storeAppId: '111', title: 'First' },
      { storeAppId: '222', title: 'Second' },
    ]);
    expect(list).toHaveBeenCalledWith({
      collection: 'toppaidapplications',
      category: 6007,
      num: 200,
      country: 'us',
    });
  });

  it('omits the category for the overall genre and caps num at 200', async () => {
    const list = jest.fn().mockResolvedValue([]);
    const provider = new AppStoreProvider(makeLib({ list }));

    await provider.topCharts('free', 'overall', 500, 'us');

    expect(list).toHaveBeenCalledWith({
      collection: 'topfreeapplications',
      num: 200,
      country: 'us',
    });
  });

  it('maps review fields and the updated date', async () => {
    const reviews = jest.fn().mockResolvedValue([
      {
        id: 'r1',
        userName: 'Alice',
        version: '2.0.0',
        score: 5,
        title: 'Great',
        text: 'Love it',
        updated: '2024-05-01T00:00:00Z',
      },
    ]);
    const provider = new AppStoreProvider(makeLib({ reviews }));

    const items = await provider.reviews('1', 'us', 1);

    expect(items[0]).toEqual({
      reviewId: 'r1',
      userName: 'Alice',
      score: 5,
      title: 'Great',
      text: 'Love it',
      version: '2.0.0',
      updatedAt: new Date('2024-05-01T00:00:00Z'),
    });
  });

  it('clamps the review page to the 1-10 range', async () => {
    const reviews = jest.fn().mockResolvedValue([]);
    const provider = new AppStoreProvider(makeLib({ reviews }));

    await provider.reviews('1', 'us', 0);
    await provider.reviews('1', 'us', 25);

    expect(reviews).toHaveBeenNthCalledWith(1, {
      id: 1,
      country: 'us',
      page: 1,
    });
    expect(reviews).toHaveBeenNthCalledWith(2, {
      id: 1,
      country: 'us',
      page: 10,
    });
  });

  it('wraps review failures in StoreRequestError', async () => {
    jest.useFakeTimers();
    const reviews = jest.fn().mockRejectedValue(new Error('boom'));
    const provider = new AppStoreProvider(makeLib({ reviews }));

    const promise = provider.reviews('1', 'us', 1);
    const assertion = expect(promise).rejects.toBeInstanceOf(StoreRequestError);
    await jest.runAllTimersAsync();
    await assertion;

    expect(reviews).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('wraps top chart failures in StoreRequestError', async () => {
    jest.useFakeTimers();
    const list = jest.fn().mockRejectedValue(new Error('boom'));
    const provider = new AppStoreProvider(makeLib({ list }));

    const promise = provider.topCharts('grossing', 'overall', 200, 'us');
    const assertion = expect(promise).rejects.toBeInstanceOf(StoreRequestError);
    await jest.runAllTimersAsync();
    await assertion;

    expect(list).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('retries transient failures then succeeds', async () => {
    jest.useFakeTimers();
    const app = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue({ id: 5, title: 'App', description: 'desc' });
    const provider = new AppStoreProvider(makeLib({ app }));

    const promise = provider.getApp('5', 'us');
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.storeAppId).toBe('5');
    expect(app).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('wraps exhausted retries in StoreRequestError', async () => {
    jest.useFakeTimers();
    const app = jest.fn().mockRejectedValue(new Error('boom'));
    const provider = new AppStoreProvider(makeLib({ app }));

    const promise = provider.getApp('1', 'us');
    const assertion = expect(promise).rejects.toBeInstanceOf(StoreRequestError);
    await jest.runAllTimersAsync();
    await assertion;

    expect(app).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('probes availability with one lookup per country', async () => {
    const app = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, title: 'App', description: 'desc' })
      .mockRejectedValueOnce(new Error('App not found (404)'))
      .mockRejectedValueOnce(new Error('socket hang up'));
    const provider = new AppStoreProvider(makeLib({ app }));

    const result = await provider.availability('1', ['us', 'de', 'jp']);

    expect(result).toEqual([
      { country: 'us', status: 'available' },
      { country: 'de', status: 'unavailable' },
      { country: 'jp', status: 'unknown' },
    ]);
    expect(app).toHaveBeenCalledTimes(3);
    expect(app).toHaveBeenNthCalledWith(1, {
      id: 1,
      country: 'us',
      ratings: false,
    });
  });

  it('maps developer apps to search items', async () => {
    const developer = jest
      .fn()
      .mockResolvedValue([
        { trackId: 42, title: 'Sibling App', developer: 'Acme', score: 4.1 },
      ]);
    const provider = new AppStoreProvider(makeLib({ developer }));

    const result = await provider.developerApps('284882218', 'us');

    expect(developer).toHaveBeenCalledWith({ devId: 284882218, country: 'us' });
    expect(result).toEqual([
      {
        storeAppId: '42',
        title: 'Sibling App',
        developer: 'Acme',
        ratingAvg: 4.1,
        ratingCount: undefined,
        updatedAt: undefined,
      },
    ]);
  });
});

describe('AppStoreProvider localized listings', () => {
  const listing = {
    id: 1,
    title: 'Where Am I? Quiz Geograficzny',
    description: 'Odkrywaj świat',
  };

  it('asks the lookup and the page for the requested localization', async () => {
    const app = jest.fn().mockResolvedValue(listing);
    const page = jest
      .fn()
      .mockResolvedValue(
        '<h1>Where Am I?</h1><p class="subtitle">Mapa Świata: Zgadnij Kraj</p>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('1', 'pl', 'pl');

    expect(app).toHaveBeenCalledWith({
      id: 1,
      country: 'pl',
      ratings: true,
      lang: 'pl',
    });
    expect(page).toHaveBeenCalledWith({ id: 1, country: 'pl', language: 'pl' });
    expect(result.title).toBe('Where Am I? Quiz Geograficzny');
    expect(result.subtitle).toBe('Mapa Świata: Zgadnij Kraj');
  });

  it('asks for norwegian and simplified chinese in the formats the store accepts', async () => {
    const app = jest.fn().mockResolvedValue(listing);
    const page = jest.fn().mockResolvedValue('<h1>App</h1>');
    const provider = new AppStoreProvider(makeLib({ app, page }));

    await provider.getApp('1', 'no', 'no');
    await provider.getApp('1', 'sg', 'zh-Hans');

    expect(
      app.mock.calls.map(([options]: [{ lang?: string }]) => options.lang),
    ).toEqual(['nb', 'zh_cn']);
    expect(
      page.mock.calls.map(
        ([options]: [{ language?: string }]) => options.language,
      ),
    ).toEqual(['nb', 'zh-Hans']);
  });

  it('reads no subtitle when a localized page renders the localized primary category', async () => {
    const app = jest.fn().mockResolvedValue({
      ...listing,
      genres: ['Finans', 'Verktøy'],
    });
    const page = jest
      .fn()
      .mockResolvedValue('<h1>Vipps</h1><p class="subtitle">Finans</p>');
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('1', 'no', 'no');

    expect(result.subtitle).toBeUndefined();
    expect(result.subtitleUnavailable).toBe(false);
  });

  it('reads no subtitle when a localized game page prints a localized subgenre', async () => {
    const app = jest.fn().mockResolvedValue({
      ...listing,
      genres: ['Oyunlar', 'Aksiyon', 'Gündelik'],
    });
    const page = jest
      .fn()
      .mockResolvedValue(
        '<h1>Super Hexagon</h1><p class="subtitle">Aksiyon</p>',
      );
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const result = await provider.getApp('1', 'tr', 'tr');

    expect(result.subtitle).toBeUndefined();
    expect(result.subtitleUnavailable).toBe(false);
  });

  it('asks for the default localization exactly as before', async () => {
    const app = jest.fn().mockResolvedValue(listing);
    const page = jest.fn().mockResolvedValue('<h1>App</h1>');
    const provider = new AppStoreProvider(makeLib({ app, page }));

    await provider.getApp('1', 'pl');

    expect(app.mock.calls[0]).toStrictEqual([
      { id: 1, country: 'pl', ratings: true },
    ]);
    expect(page.mock.calls[0]).toStrictEqual([{ id: 1, country: 'pl' }]);
  });
});

describe('AppStoreProvider on demand deadline', () => {
  const DEADLINE_MS = 50;

  const hangsUntilAborted = () =>
    jest.fn(
      (options: { signal?: AbortSignal }) =>
        new Promise<never>((_, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new Error('This operation was aborted')),
          );
        }),
    );

  it('answers a store error at the deadline instead of retrying a store that does not answer', async () => {
    const app = hangsUntilAborted();
    const provider = new AppStoreProvider(makeLib({ app }));
    const started = Date.now();

    const failure = await withinStoreDeadline(
      () =>
        provider.getApp('1475326567', 'us').catch((error: unknown) => error),
      DEADLINE_MS,
    );

    expect(failure).toBeInstanceOf(StoreRequestError);
    expect((failure as StoreRequestError).userMessage).toBe(
      'The App Store did not answer. Try again in a few minutes.',
    );
    expect(app).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('cuts a retry pause short when the deadline passes during it', async () => {
    const search = jest.fn().mockRejectedValue(new Error('fetch failed'));
    const provider = new AppStoreProvider(makeLib({ search }));
    const started = Date.now();

    const failure = await withinStoreDeadline(
      () => provider.search('habit', 'us', 10).catch((error: unknown) => error),
      DEADLINE_MS,
    );

    expect(failure).toBeInstanceOf(StoreRequestError);
    expect(search).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('hands the deadline to the lookup and the product page', async () => {
    const app = jest
      .fn()
      .mockResolvedValue({ id: 1, title: 'App', description: 'desc' });
    const page = jest.fn().mockResolvedValue('<h1>App</h1>');
    const provider = new AppStoreProvider(makeLib({ app, page }));

    const signal = await withinStoreDeadline(async () => {
      await provider.getApp('1', 'us');
      return storeDeadline().signal;
    });

    expect(app).toHaveBeenCalledWith(expect.objectContaining({ signal }));
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ signal }));
  });

  it('reports an availability probe cut by the deadline as unknown', async () => {
    const app = hangsUntilAborted();
    const provider = new AppStoreProvider(makeLib({ app }));

    const result = await withinStoreDeadline(
      () => provider.availability('1', ['de']),
      DEADLINE_MS,
    );

    expect(result).toEqual([{ country: 'de', status: 'unknown' }]);
  });
});
