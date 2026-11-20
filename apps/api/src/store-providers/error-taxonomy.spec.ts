import { ProxyOutcome, Store } from '@prisma/client';
import { AppStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { classifyFailure } from './egress/proxy-outcome';
import {
  StoreAppNotFoundError,
  StoreNotSupportedError,
  StorePoolBusyError,
  StoreRequestError,
} from './errors';
import { NotFoundError, ParseError } from '@mradex77/google-play-scraper';
import { GooglePlayLib } from './google-play.lib';
import { GooglePlayProvider } from './google-play.provider';
import { withinStoreDeadline } from './store-deadline';
import { StoreProviderRegistry } from './store-provider.registry';

const APP_STORE_ATTEMPTS = 3;

const TRANSPORT_ERROR = new Error('Request failed with status 503');
const PARSE_ERROR = new TypeError(
  "Cannot read properties of undefined (reading 'trackId')",
);
const NOT_FOUND_ERROR = new Error('App not found: 1');
const PROXY_NOT_FOUND_ERROR = new Error(
  'Request failed with status 404: Not Found',
);
const PLAY_NOT_FOUND_ERROR = new NotFoundError(
  'App not found (404)',
  404,
  'https://play.google.com/store/apps/details?id=com.example',
);
const PLAY_PARSE_ERROR = new ParseError('title selector not found');

const makeAppStoreLib = (
  overrides: Partial<AppStoreLib> = {},
): AppStoreLib => ({
  app: jest.fn(),
  page: jest.fn().mockResolvedValue(''),
  search: jest.fn(),
  suggest: jest.fn(),
  list: jest.fn(),
  reviews: jest.fn(),
  developer: jest.fn(),
  ...overrides,
});

const makeGooglePlayLib = (
  overrides: Partial<GooglePlayLib> = {},
): GooglePlayLib =>
  ({
    app: jest.fn(),
    search: jest.fn(),
    suggest: jest.fn(),
    similar: jest.fn(),
    list: jest.fn(),
    reviews: jest.fn(),
    developer: jest.fn(),
    ...overrides,
  }) as GooglePlayLib;

describe('provider error taxonomy', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const settle = async <T>(work: Promise<T>): Promise<unknown> => {
    const caught = work.catch((error: unknown) => error);
    await jest.runAllTimersAsync();
    return caught;
  };

  describe('the app store provider', () => {
    it.each([
      ['a transport failure', TRANSPORT_ERROR],
      ['a parse failure', PARSE_ERROR],
    ])('wraps %s in a StoreRequestError', async (_name, cause) => {
      const app = jest.fn().mockRejectedValue(cause);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      const error = await settle(provider.getApp('1', 'us'));

      expect(error).toBeInstanceOf(StoreRequestError);
      expect((error as StoreRequestError).store).toBe(Store.APP_STORE);
      expect((error as StoreRequestError).method).toBe('getApp');
      expect((error as StoreRequestError).causeMessage).toBe(cause.message);
    });

    it('separates a missing app from an upstream failure', async () => {
      const app = jest.fn().mockRejectedValue(NOT_FOUND_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      const error = await settle(provider.getApp('1', 'us'));

      expect(error).toBeInstanceOf(StoreAppNotFoundError);
      expect(error).not.toBeInstanceOf(StoreRequestError);
      expect((error as StoreAppNotFoundError).store).toBe(Store.APP_STORE);
      expect((error as StoreAppNotFoundError).storeAppId).toBe('1');
    });

    it('does not mistake an upstream 404 page for a missing app', async () => {
      const app = jest.fn().mockRejectedValue(PROXY_NOT_FOUND_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      const error = await settle(provider.getApp('1', 'us'));

      expect(error).toBeInstanceOf(StoreRequestError);
      expect(error).not.toBeInstanceOf(StoreAppNotFoundError);
    });

    it('retries a missing app as often as any other failure', async () => {
      const app = jest.fn().mockRejectedValue(NOT_FOUND_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      await settle(provider.getApp('1', 'us'));

      expect(app).toHaveBeenCalledTimes(APP_STORE_ATTEMPTS);
    });

    it('does not distinguish a parse failure from a transport failure', async () => {
      const transport = await settle(
        new AppStoreProvider(
          makeAppStoreLib({
            app: jest.fn().mockRejectedValue(TRANSPORT_ERROR),
          }),
        ).getApp('1', 'us'),
      );
      const parse = await settle(
        new AppStoreProvider(
          makeAppStoreLib({ app: jest.fn().mockRejectedValue(PARSE_ERROR) }),
        ).getApp('1', 'us'),
      );

      expect((transport as Error).constructor).toBe(
        (parse as Error).constructor,
      );
      expect((transport as StoreRequestError).name).toBe('StoreRequestError');
      expect((parse as StoreRequestError).name).toBe('StoreRequestError');
    });

    it('attempts every failure the same number of times', async () => {
      const app = jest.fn().mockRejectedValue(TRANSPORT_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      await settle(provider.getApp('1', 'us'));

      expect(app).toHaveBeenCalledTimes(APP_STORE_ATTEMPTS);
    });

    it('resolves rather than retries once a call succeeds', async () => {
      const app = jest
        .fn()
        .mockRejectedValueOnce(TRANSPORT_ERROR)
        .mockResolvedValue({ id: 1, title: 'App', description: '' });
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      const result = await settle(provider.getApp('1', 'us'));

      expect(result).toMatchObject({ storeAppId: '1' });
      expect(app).toHaveBeenCalledTimes(2);
    });

    it('names the failing method so a broken parser can be located', async () => {
      const search = jest.fn().mockRejectedValue(PARSE_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ search }));

      const error = await settle(provider.search('planner', 'us', 10));

      expect((error as StoreRequestError).method).toBe('search');
      expect((error as StoreRequestError).message).toContain('APP_STORE');
      expect((error as StoreRequestError).message).toContain('search');
    });

    it('reports an unavailable market rather than throwing for a missing app', async () => {
      const app = jest.fn().mockRejectedValue(NOT_FOUND_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      await expect(provider.availability('1', ['jp'])).resolves.toEqual([
        { country: 'jp', status: 'unavailable' },
      ]);
    });

    it('reports an unknown market when the probe fails for another reason', async () => {
      const app = jest.fn().mockRejectedValue(TRANSPORT_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      await expect(provider.availability('1', ['jp'])).resolves.toEqual([
        { country: 'jp', status: 'unknown' },
      ]);
    });
  });

  describe('the google play provider', () => {
    it.each([
      ['a transport failure', TRANSPORT_ERROR],
      ['a parse failure', PARSE_ERROR],
    ])('wraps %s in a StoreRequestError', async (_name, cause) => {
      const app = jest.fn().mockRejectedValue(cause);
      const provider = new GooglePlayProvider(makeGooglePlayLib({ app }));

      const error = await settle(provider.getApp('com.example', 'us'));

      expect(error).toBeInstanceOf(StoreRequestError);
      expect((error as StoreRequestError).store).toBe(Store.GOOGLE_PLAY);
      expect((error as StoreRequestError).method).toBe('getApp');
      expect((error as StoreRequestError).causeMessage).toBe(
        `${cause.name}: ${cause.message}`,
      );
    });

    it('separates a missing app from an upstream failure', async () => {
      const app = jest.fn().mockRejectedValue(PLAY_NOT_FOUND_ERROR);
      const provider = new GooglePlayProvider(makeGooglePlayLib({ app }));

      const error = await settle(provider.getApp('com.example', 'us'));

      expect(error).toBeInstanceOf(StoreAppNotFoundError);
      expect((error as StoreAppNotFoundError).store).toBe(Store.GOOGLE_PLAY);
      expect((error as StoreAppNotFoundError).storeAppId).toBe('com.example');
    });

    it('keeps a parse failure that mentions a missing selector upstream', async () => {
      const app = jest.fn().mockRejectedValue(PLAY_PARSE_ERROR);
      const provider = new GooglePlayProvider(makeGooglePlayLib({ app }));

      const error = await settle(provider.getApp('com.example', 'us'));

      expect(error).toBeInstanceOf(StoreRequestError);
      expect(error).not.toBeInstanceOf(StoreAppNotFoundError);
    });

    it('does not retry, unlike the app store provider', async () => {
      const app = jest.fn().mockRejectedValue(TRANSPORT_ERROR);
      const provider = new GooglePlayProvider(makeGooglePlayLib({ app }));

      await settle(provider.getApp('com.example', 'us'));

      expect(app).toHaveBeenCalledTimes(1);
    });
  });

  describe('the registry', () => {
    it('serves both live stores', () => {
      const registry = new StoreProviderRegistry(
        new AppStoreProvider(makeAppStoreLib()),
        new GooglePlayProvider(makeGooglePlayLib()),
      );

      expect(registry.get(Store.APP_STORE).store).toBe(Store.APP_STORE);
      expect(registry.get(Store.GOOGLE_PLAY).store).toBe(Store.GOOGLE_PLAY);
    });

    it('rejects an unregistered store with StoreNotSupportedError', () => {
      const registry = new StoreProviderRegistry(
        new AppStoreProvider(makeAppStoreLib()),
        new GooglePlayProvider(makeGooglePlayLib()),
      );

      expect(() => registry.get('AMAZON' as Store)).toThrow(
        StoreNotSupportedError,
      );
    });
  });
});

describe('StoreAppNotFoundError', () => {
  it('names the storefront for the operator when it is known', () => {
    expect(
      new StoreAppNotFoundError(Store.GOOGLE_PLAY, 'com.example', 'us').message,
    ).toBe('GOOGLE_PLAY has no app com.example in us');
    expect(new StoreAppNotFoundError(Store.APP_STORE, '1').message).toBe(
      'APP_STORE has no app 1',
    );
  });

  it('tells a person the same thing with or without the storefront', () => {
    expect(
      new StoreAppNotFoundError(Store.APP_STORE, '1', 'us').userMessage,
    ).toBe(new StoreAppNotFoundError(Store.APP_STORE, '1').userMessage);
    expect(
      new StoreAppNotFoundError(Store.GOOGLE_PLAY, 'com.example', 'de')
        .userMessage,
    ).toBe('Google Play has no app com.example.');
  });

  it('carries the storefront both providers looked in', async () => {
    jest.useFakeTimers();
    const appStore = new AppStoreProvider(
      makeAppStoreLib({ app: jest.fn().mockRejectedValue(NOT_FOUND_ERROR) }),
    );
    const play = new GooglePlayProvider(
      makeGooglePlayLib({
        app: jest.fn().mockRejectedValue(PLAY_NOT_FOUND_ERROR),
      }),
    );

    const errors = Promise.all([
      appStore.getApp('1', 'de').catch((error: unknown) => error),
      play.getApp('com.example', 'jp').catch((error: unknown) => error),
    ]);
    await jest.runAllTimersAsync();
    const [apple, google] = await errors;
    jest.useRealTimers();

    expect((apple as StoreAppNotFoundError).message).toBe(
      'APP_STORE has no app 1 in de',
    );
    expect((google as StoreAppNotFoundError).message).toBe(
      'GOOGLE_PLAY has no app com.example in jp',
    );
  });

  it('trusts no not found answer the deadline cut short, on either store', async () => {
    const appStore = new AppStoreProvider(
      makeAppStoreLib({ app: jest.fn().mockRejectedValue(NOT_FOUND_ERROR) }),
    );
    const play = new GooglePlayProvider(
      makeGooglePlayLib({
        app: jest.fn().mockRejectedValue(PLAY_NOT_FOUND_ERROR),
      }),
    );

    const [apple, google] = await Promise.all([
      withinStoreDeadline(
        () => appStore.getApp('1', 'us').catch((error: unknown) => error),
        50,
      ),
      withinStoreDeadline(
        () => play.getApp('com.example', 'us').catch((error: unknown) => error),
        50,
      ),
    ]);

    expect(apple).toBeInstanceOf(StoreRequestError);
    expect(google).toBeInstanceOf(StoreRequestError);
  });
});

describe('store failure reasons', () => {
  const TURNED_AWAY =
    'Google Play turned the request away for now. Try again in a few minutes.';

  const failedPastDeadline = (store: Store, causeMessage: string) =>
    withinStoreDeadline(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new StoreRequestError(store, 'getApp', causeMessage);
    }, 1);

  it.each([
    [
      'names a play call the deadline cut short',
      Store.GOOGLE_PLAY,
      'TimeoutError: The operation was aborted due to timeout',
      'Google Play took longer than 20 seconds to answer. Try again in a few minutes.',
    ],
    [
      'names an app store call the deadline cut short',
      Store.APP_STORE,
      'The operation was aborted due to timeout',
      'The App Store took longer than 20 seconds to answer. Try again in a few minutes.',
    ],
    [
      'names a call the deadline aborted',
      Store.APP_STORE,
      'This operation was aborted',
      'The App Store took longer than 20 seconds to answer. Try again in a few minutes.',
    ],
  ])('%s', async (_case, store, causeMessage, sentence) => {
    const error = await failedPastDeadline(store, causeMessage);

    expect(error.reason).toBe('deadline');
    expect(error.userMessage).toBe(sentence);
  });

  it.each([
    [
      'names an app store attempt that timed out with no request deadline as slow',
      Store.APP_STORE,
      'The operation was aborted due to timeout',
      'The App Store took too long to answer. Try again in a few minutes.',
    ],
    [
      'names a play call that timed out with no request deadline as slow',
      Store.GOOGLE_PLAY,
      'TimeoutError: The operation was aborted due to timeout',
      'Google Play took too long to answer. Try again in a few minutes.',
    ],
  ])('%s', (_case, store, causeMessage, sentence) => {
    const error = new StoreRequestError(store, 'getApp', causeMessage);

    expect(error.reason).toBe('slow');
    expect(error.userMessage).toBe(sentence);
  });

  it('keeps the reason of a failure inside a deadline that has not passed', async () => {
    const error = await withinStoreDeadline(
      () =>
        Promise.resolve(
          new StoreRequestError(
            Store.GOOGLE_PLAY,
            'getApp',
            'Request failed with status 429',
          ),
        ),
      60_000,
    );

    expect(error.reason).toBe('refused');
  });

  it.each([
    [
      'names a rate limited request as turned away',
      Store.GOOGLE_PLAY,
      'Request failed with status 429',
      'refused',
      TURNED_AWAY,
    ],
    [
      'names a blocked request as turned away',
      Store.GOOGLE_PLAY,
      'BlockedError: Blocked by Google Play (captcha challenge)',
      'refused',
      TURNED_AWAY,
    ],
    [
      'names a store that answered 503 as turned away',
      Store.APP_STORE,
      'Request failed with status 503',
      'refused',
      'The App Store turned the request away for now. Try again in a few minutes.',
    ],
    [
      'names a connection failure as unreachable',
      Store.GOOGLE_PLAY,
      'RequestError: fetch failed',
      'unreachable',
      'Google Play could not be reached. Try again in a few minutes.',
    ],
    [
      'names a failed name lookup as unreachable',
      Store.APP_STORE,
      'getaddrinfo ENOTFOUND itunes.apple.com',
      'unreachable',
      'The App Store could not be reached. Try again in a few minutes.',
    ],
    [
      'names a name lookup that failed for now as unreachable',
      Store.GOOGLE_PLAY,
      'RequestError: getaddrinfo EAI_AGAIN play.google.com',
      'unreachable',
      'Google Play could not be reached. Try again in a few minutes.',
    ],
    [
      'names a broken page as unreadable',
      Store.GOOGLE_PLAY,
      'ParseError: title selector not found',
      'unreadable',
      'Google Play answered something asobeast could not read. Try again later.',
    ],
  ])('%s', (_case, store, causeMessage, reason, sentence) => {
    const error = new StoreRequestError(store, 'getApp', causeMessage);

    expect(error.reason).toBe(reason);
    expect(error.userMessage).toBe(sentence);
  });

  it('reads a timeout before the transport pattern', async () => {
    const cause = 'TimeoutError: The operation was aborted due to timeout';

    expect(classifyFailure(cause)).toBe(ProxyOutcome.TRANSPORT);
    expect((await failedPastDeadline(Store.GOOGLE_PLAY, cause)).reason).toBe(
      'deadline',
    );
    expect(
      new StoreRequestError(Store.GOOGLE_PLAY, 'getApp', cause).reason,
    ).toBe('slow');
  });

  it('keeps the busy pool sentence', () => {
    expect(new StorePoolBusyError(Store.GOOGLE_PLAY, 3_000).userMessage).toBe(
      'This server is busy reaching Google Play. Try again in 3 seconds.',
    );
  });
});
