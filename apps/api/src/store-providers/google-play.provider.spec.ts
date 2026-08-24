import { Store } from '@prisma/client';
import { StoreRequestError } from './errors';
import { GooglePlayLib, GPLAY_COLLECTIONS } from './google-play.lib';
import { GooglePlayProvider, googlePlayLanguage } from './google-play.provider';

const makeLib = (overrides: Partial<GooglePlayLib> = {}): GooglePlayLib => ({
  app: jest.fn(),
  search: jest.fn(),
  suggest: jest.fn(),
  similar: jest.fn(),
  list: jest.fn(),
  reviews: jest.fn(),
  availability: jest.fn(),
  developer: jest.fn(),
  ...overrides,
});

const appPayload = {
  appId: 'com.example.app',
  title: 'Example',
  summary: 'Short description',
  description: 'Full description',
  icon: 'https://icon',
  score: 4.2,
  ratings: 5000,
  minInstalls: 1000000,
  price: 0,
  version: '3.1.0',
  released: 'May 30, 2013',
  updated: 1719792000000,
  genre: 'Tools',
  genreId: 'TOOLS',
  screenshots: ['a', 'b'],
  recentChanges: 'Bug fixes',
};

describe('googlePlayLanguage', () => {
  it('maps known countries and falls back to en', () => {
    expect(googlePlayLanguage('de')).toBe('de');
    expect(googlePlayLanguage('BR')).toBe('pt');
    expect(googlePlayLanguage('zz')).toBe('en');
  });
});

describe('GooglePlayProvider', () => {
  it('reports the Google Play store', () => {
    expect(new GooglePlayProvider(makeLib()).store).toBe(Store.GOOGLE_PLAY);
  });

  it('normalizes app fields including bigint installs and epoch updated', async () => {
    const app = jest.fn().mockResolvedValue(appPayload);
    const provider = new GooglePlayProvider(makeLib({ app }));

    const result = await provider.getApp('com.example.app', 'de');

    expect(app).toHaveBeenCalledWith({
      appId: 'com.example.app',
      country: 'de',
      lang: 'de',
    });
    expect(result.store).toBe(Store.GOOGLE_PLAY);
    expect(result.storeAppId).toBe('com.example.app');
    expect(result.summary).toBe('Short description');
    expect(result.subtitle).toBeUndefined();
    expect(result.ratingAvg).toBe(4.2);
    expect(result.ratingCount).toBe(5000);
    expect(result.installs).toBe(BigInt(1000000));
    expect(result.releasedAt).toEqual(new Date('May 30, 2013'));
    expect(result.storeUpdatedAt).toEqual(new Date(1719792000000));
  });

  it('omits installs when minInstalls is absent', async () => {
    const app = jest
      .fn()
      .mockResolvedValue({ ...appPayload, minInstalls: undefined });
    const provider = new GooglePlayProvider(makeLib({ app }));

    const result = await provider.getApp('com.example.app', 'us');

    expect(result.installs).toBeUndefined();
  });

  it('returns undefined releasedAt when released is unparseable', async () => {
    const app = jest
      .fn()
      .mockResolvedValue({ ...appPayload, released: '30 мая 2013 г.' });
    const provider = new GooglePlayProvider(makeLib({ app }));

    const result = await provider.getApp('com.example.app', 'ru');

    expect(result.releasedAt).toBeUndefined();
  });

  it('maps search results with the rating average only', async () => {
    const search = jest.fn().mockResolvedValue([
      { appId: 'com.a', title: 'A', developer: 'Dev A', score: 4.5 },
      { appId: 'com.b', title: 'B', developer: 'Dev B' },
    ]);
    const provider = new GooglePlayProvider(makeLib({ search }));

    const results = await provider.search('note', 'us', 500);

    expect(search).toHaveBeenCalledWith({
      term: 'note',
      country: 'us',
      lang: 'en',
      num: 250,
    });
    expect(results).toEqual([
      { storeAppId: 'com.a', title: 'A', developer: 'Dev A', ratingAvg: 4.5 },
      {
        storeAppId: 'com.b',
        title: 'B',
        developer: 'Dev B',
        ratingAvg: undefined,
      },
    ]);
  });

  it('maps suggest strings to term objects', async () => {
    const suggest = jest.fn().mockResolvedValue(['note taking', 'notes']);
    const provider = new GooglePlayProvider(makeLib({ suggest }));

    const results = await provider.suggest('note', 'us');

    expect(results).toEqual([{ term: 'note taking' }, { term: 'notes' }]);
  });

  it('maps similar results like search', async () => {
    const similar = jest
      .fn()
      .mockResolvedValue([
        { appId: 'com.c', title: 'C', developer: 'Dev C', score: 3.9 },
      ]);
    const provider = new GooglePlayProvider(makeLib({ similar }));

    const results = await provider.similar('com.example.app', 'us');

    expect(similar).toHaveBeenCalledWith({
      appId: 'com.example.app',
      country: 'us',
      lang: 'en',
    });
    expect(results).toEqual([
      { storeAppId: 'com.c', title: 'C', developer: 'Dev C', ratingAvg: 3.9 },
    ]);
  });

  it('maps the collection and passes through the genre key', async () => {
    const list = jest
      .fn()
      .mockResolvedValue([{ appId: 'com.d', title: 'D', developer: 'Dev D' }]);
    const provider = new GooglePlayProvider(makeLib({ list }));

    await provider.topCharts('paid', 'GAME_ACTION', 600, 'us');

    expect(list).toHaveBeenCalledWith({
      collection: GPLAY_COLLECTIONS.TOP_PAID,
      category: 'GAME_ACTION',
      num: 500,
      country: 'us',
      lang: 'en',
    });
  });

  it('maps the overall genre to the APPLICATION category', async () => {
    const list = jest.fn().mockResolvedValue([]);
    const provider = new GooglePlayProvider(makeLib({ list }));

    await provider.topCharts('free', 'overall', 100, 'us');

    expect(list).toHaveBeenCalledWith({
      collection: GPLAY_COLLECTIONS.TOP_FREE,
      category: 'APPLICATION',
      num: 100,
      country: 'us',
      lang: 'en',
    });
  });

  it('walks pagination tokens to reach the requested review page', async () => {
    const reviews = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 'r1', userName: 'One', score: 5, text: 'first' }],
        nextPaginationToken: 'tok1',
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'r2',
            userName: 'Two',
            score: 4,
            title: 'Nice',
            text: 'second',
            version: '2.0',
            date: '2026-07-10T00:00:00.000Z',
          },
        ],
        nextPaginationToken: null,
      });
    const provider = new GooglePlayProvider(makeLib({ reviews }));

    const results = await provider.reviews('com.example.app', 'us', 2);

    expect(reviews).toHaveBeenCalledTimes(2);
    expect(reviews).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ nextPaginationToken: undefined }),
    );
    expect(reviews).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ nextPaginationToken: 'tok1' }),
    );
    expect(results).toEqual([
      {
        reviewId: 'r2',
        userName: 'Two',
        score: 4,
        title: 'Nice',
        text: 'second',
        version: '2.0',
        updatedAt: new Date('2026-07-10T00:00:00.000Z'),
      },
    ]);
  });

  it('short-circuits to an empty page when the token runs out early', async () => {
    const reviews = jest.fn().mockResolvedValue({
      data: [{ id: 'r1', userName: 'One', score: 5, text: 'first' }],
      nextPaginationToken: null,
    });
    const provider = new GooglePlayProvider(makeLib({ reviews }));

    const results = await provider.reviews('com.example.app', 'us', 3);

    expect(reviews).toHaveBeenCalledTimes(1);
    expect(results).toEqual([]);
  });

  it('wraps lib errors as StoreRequestError preserving the upstream name', async () => {
    const failure = new Error('not found');
    failure.name = 'NotFoundError';
    const app = jest.fn().mockRejectedValue(failure);
    const provider = new GooglePlayProvider(makeLib({ app }));

    let caught: unknown;
    try {
      await provider.getApp('com.missing', 'us');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StoreRequestError);
    expect((caught as StoreRequestError).message).toContain('NotFoundError');
  });

  it('maps scraper availability statuses and treats error as unknown', async () => {
    const availability = jest.fn().mockResolvedValue({
      appId: 'com.example.app',
      countries: {
        us: { status: 'available' },
        de: { status: 'unavailable' },
        jp: { status: 'error', message: 'blocked' },
      },
    });
    const provider = new GooglePlayProvider(makeLib({ availability }));

    const result = await provider.availability('com.example.app', [
      'us',
      'de',
      'jp',
      'br',
    ]);

    expect(availability).toHaveBeenCalledWith({
      appId: 'com.example.app',
      countries: ['us', 'de', 'jp', 'br'],
      lang: 'en',
    });
    expect(result).toEqual([
      { country: 'us', status: 'available' },
      { country: 'de', status: 'unavailable' },
      { country: 'jp', status: 'unknown' },
      { country: 'br', status: 'unknown' },
    ]);
  });

  it('reports unknown for every country when the probe call fails', async () => {
    const availability = jest.fn().mockRejectedValue(new Error('boom'));
    const provider = new GooglePlayProvider(makeLib({ availability }));

    await expect(
      provider.availability('com.example.app', ['de']),
    ).resolves.toEqual([{ country: 'de', status: 'unknown' }]);
  });

  it('maps developer apps to search items', async () => {
    const developer = jest.fn().mockResolvedValue([
      {
        appId: 'com.example.other',
        title: 'Other App',
        developer: 'Acme',
        score: 4.4,
      },
    ]);
    const provider = new GooglePlayProvider(makeLib({ developer }));

    const result = await provider.developerApps('Acme', 'de');

    expect(developer).toHaveBeenCalledWith({
      devId: 'Acme',
      country: 'de',
      lang: 'de',
      num: 30,
    });
    expect(result).toEqual([
      {
        storeAppId: 'com.example.other',
        title: 'Other App',
        developer: 'Acme',
        ratingAvg: 4.4,
      },
    ]);
  });
});
