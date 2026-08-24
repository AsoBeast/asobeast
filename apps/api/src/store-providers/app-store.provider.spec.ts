import { Store } from '@prisma/client';
import { AppStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { StoreRequestError } from './errors';

const makeLib = (overrides: Partial<AppStoreLib> = {}): AppStoreLib => ({
  app: jest.fn(),
  page: jest.fn().mockResolvedValue(''),
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
