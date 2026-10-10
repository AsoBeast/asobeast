import { BlockedError } from '@mradex77/google-play-scraper';
import { ProxyOutcome, Store } from '@prisma/client';
import { outcomeOf } from './egress/proxy-health.service';
import { StoreRequestError } from './errors';
import { storeDeadline, withinStoreDeadline } from './store-deadline';
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

  it.each([
    ['tw', 'zh-TW'],
    ['TW', 'zh-TW'],
    ['hk', 'zh-HK'],
    ['HK', 'zh-HK'],
  ])('asks for the traditional listing in %s as %s', (country, language) => {
    expect(googlePlayLanguage(country)).toBe(language);
  });

  it.each(['constructor', '__proto__', 'toString'])(
    'falls back to en for the inherited object key %s',
    (country) => {
      expect(googlePlayLanguage(country)).toBe('en');
    },
  );
});

interface LanguageCall {
  result: unknown;
  invoke: (provider: GooglePlayProvider, country: string) => Promise<unknown>;
}

const LANGUAGE_CALLS = {
  app: {
    result: appPayload,
    invoke: (provider, country) => provider.getApp('com.example.app', country),
  },
  search: {
    result: [],
    invoke: (provider, country) => provider.search('note', country, 10),
  },
  suggest: {
    result: [],
    invoke: (provider, country) => provider.suggest('note', country),
  },
  similar: {
    result: [],
    invoke: (provider, country) => provider.similar('com.example.app', country),
  },
  list: {
    result: [],
    invoke: (provider, country) =>
      provider.topCharts('free', 'OVERALL', 100, country),
  },
  reviews: {
    result: { data: [], nextPaginationToken: null },
    invoke: (provider, country) =>
      provider.reviews('com.example.app', country, 1),
  },
  availability: {
    result: { appId: 'com.example.app', countries: {} },
    invoke: (provider, country) =>
      provider.availability('com.example.app', [country]),
  },
  developer: {
    result: [],
    invoke: (provider, country) => provider.developerApps('Dev', country),
  },
} satisfies Record<keyof GooglePlayLib, LanguageCall>;

describe.each(Object.entries(LANGUAGE_CALLS))(
  'GooglePlayLib.%s language',
  (lib, { result, invoke }) => {
    it.each([
      ['tw', 'zh-TW'],
      ['TW', 'zh-TW'],
      ['hk', 'zh-HK'],
      ['us', 'en'],
      ['jp', 'ja'],
    ])('asks the store for %s in %s', async (country, language) => {
      const call = jest.fn().mockResolvedValue(result);
      const provider = new GooglePlayProvider(makeLib({ [lib]: call }));

      await invoke(provider, country);

      expect(call).toHaveBeenCalledWith(
        expect.objectContaining({ lang: language }),
      );
    });
  },
);

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

  it.each([
    'Use &amp; to escape',
    'Type &lt;Username&gt; to mention',
    'Create & share photos',
    'Short description',
  ])(
    'stores the plain text short description %j unchanged',
    async (summary) => {
      const app = jest.fn().mockResolvedValue({ ...appPayload, summary });
      const provider = new GooglePlayProvider(makeLib({ app }));

      const result = await provider.getApp('com.example.app', 'us');

      expect(result.summary).toBe(summary);
      expect((result.raw as { summary: string }).summary).toBe(summary);
    },
  );

  it('leaves an absent short description absent', async () => {
    const app = jest
      .fn()
      .mockResolvedValue({ ...appPayload, summary: undefined });
    const provider = new GooglePlayProvider(makeLib({ app }));

    const result = await provider.getApp('com.example.app', 'us');

    expect(result.summary).toBeUndefined();
  });

  it('leaves the version absent when the store says it varies with the device', async () => {
    const app = jest.fn().mockResolvedValue({ ...appPayload, version: 'VARY' });
    const provider = new GooglePlayProvider(makeLib({ app }));

    const result = await provider.getApp('org.telegram.messenger', 'us');

    expect(result.version).toBeUndefined();
    expect((result.raw as { version: string }).version).toBe('VARY');
  });

  it.each(['3.1.0', '12', '2026.01.15', 'VARYING'])(
    'keeps the version %j',
    async (version) => {
      const app = jest.fn().mockResolvedValue({ ...appPayload, version });
      const provider = new GooglePlayProvider(makeLib({ app }));

      const result = await provider.getApp('com.example.app', 'us');

      expect(result.version).toBe(version);
    },
  );

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
        repliedAt: undefined,
      },
    ]);
  });

  it('maps the developer reply date', async () => {
    const reviews = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'r1',
          userName: 'a',
          date: '2026-09-01T10:00:00.000Z',
          score: 2,
          title: null,
          text: 'Crashes',
          version: '3.1',
          replyDate: '2026-09-02T08:00:00.000Z',
        },
        {
          id: 'r2',
          userName: 'b',
          date: '2026-09-01T11:00:00.000Z',
          score: 5,
          title: null,
          text: 'Great',
          version: '3.1',
        },
        {
          id: 'r3',
          userName: 'c',
          date: '2026-09-01T12:00:00.000Z',
          score: 1,
          title: null,
          text: 'Broken',
          version: '3.1',
          replyDate: 'not a date',
        },
      ],
      nextPaginationToken: null,
    });
    const provider = new GooglePlayProvider(makeLib({ reviews }));

    const results = await provider.reviews('com.example.app', 'us', 1);

    expect(results.map((review) => review.repliedAt)).toEqual([
      new Date('2026-09-02T08:00:00.000Z'),
      undefined,
      undefined,
    ]);
  });

  it('maps a rating only review to empty text and no optional fields', async () => {
    const reviews = jest.fn().mockResolvedValue({
      data: [
        {
          id: '7ed572cd-bfb0-4c48-9345-3ef21e6b603d',
          userName: 'Een Google-gebruiker',
          date: '2014-02-12T09:59:24.595Z',
          score: 5,
          title: null,
          version: '2-build-26',
        },
        {
          id: 'bare',
          userName: 'Een Google-gebruiker',
          date: '2014-02-13T09:59:24.595Z',
          score: 1,
        },
      ],
      nextPaginationToken: null,
    });
    const provider = new GooglePlayProvider(makeLib({ reviews }));

    const results = await provider.reviews('com.example.app', 'nl', 1);

    expect(results).toEqual([
      {
        reviewId: '7ed572cd-bfb0-4c48-9345-3ef21e6b603d',
        userName: 'Een Google-gebruiker',
        score: 5,
        title: undefined,
        text: '',
        version: '2-build-26',
        updatedAt: new Date('2014-02-12T09:59:24.595Z'),
        repliedAt: undefined,
      },
      {
        reviewId: 'bare',
        userName: 'Een Google-gebruiker',
        score: 1,
        title: undefined,
        text: '',
        version: undefined,
        updatedAt: new Date('2014-02-13T09:59:24.595Z'),
        repliedAt: undefined,
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
    const failure = new Error('socket hang up');
    failure.name = 'RequestError';
    const app = jest.fn().mockRejectedValue(failure);
    const provider = new GooglePlayProvider(makeLib({ app }));

    let caught: unknown;
    try {
      await provider.getApp('com.missing', 'us');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StoreRequestError);
    expect((caught as StoreRequestError).message).toContain('RequestError');
  });

  it('reports a scraper captcha or consent wall as a blocked egress', async () => {
    for (const block of ['captcha challenge', 'consent wall']) {
      const app = jest
        .fn()
        .mockRejectedValue(
          new BlockedError(`Blocked by Google Play (${block})`),
        );
      const provider = new GooglePlayProvider(makeLib({ app }));

      const caught: unknown = await provider
        .getApp('com.example.app', 'us')
        .catch((error: unknown) => error);

      expect(caught).toBeInstanceOf(StoreRequestError);
      expect(outcomeOf(caught)).toBe(ProxyOutcome.BLOCKED);
    }
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

describe('GooglePlayProvider on demand deadline', () => {
  it('answers a store error at the deadline instead of waiting for the scraper retries', async () => {
    const app = jest.fn(
      (options: { signal?: AbortSignal }) =>
        new Promise<never>((_, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(options.signal?.reason as Error),
          );
        }),
    );
    const provider = new GooglePlayProvider(makeLib({ app }));

    const failure = await withinStoreDeadline(
      () =>
        provider
          .getApp('com.cyberlink.youcammakeup', 'tw')
          .catch((error: unknown) => error),
      50,
    );

    expect(failure).toBeInstanceOf(StoreRequestError);
    expect((failure as StoreRequestError).userMessage).toBe(
      'Google Play did not answer. Try again in a few minutes.',
    );
    expect((failure as StoreRequestError).causeMessage).toContain(
      'TimeoutError',
    );
  });

  it('hands the deadline to the scraper', async () => {
    const suggest = jest.fn().mockResolvedValue(['habit tracker']);
    const provider = new GooglePlayProvider(makeLib({ suggest }));

    const signal = await withinStoreDeadline(async () => {
      await provider.suggest('habit', 'us');
      return storeDeadline().signal;
    });

    expect(suggest).toHaveBeenCalledWith(expect.objectContaining({ signal }));
  });

  it('sends no signal outside an on demand request', async () => {
    const suggest = jest.fn().mockResolvedValue([]);
    const provider = new GooglePlayProvider(makeLib({ suggest }));

    await provider.suggest('habit', 'us');

    expect(suggest.mock.calls[0]).toStrictEqual([
      { term: 'habit', country: 'us', lang: 'en' },
    ]);
  });
});
