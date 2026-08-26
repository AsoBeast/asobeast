import { Store } from '@prisma/client';
import { AppStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import {
  StoreAppNotFoundError,
  StoreNotSupportedError,
  StoreRequestError,
} from './errors';
import { GooglePlayLib } from './google-play.lib';
import { GooglePlayProvider } from './google-play.provider';
import { StoreProviderRegistry } from './store-provider.registry';

const APP_STORE_ATTEMPTS = 3;

const TRANSPORT_ERROR = new Error('Request failed with status 503');
const PARSE_ERROR = new TypeError(
  "Cannot read properties of undefined (reading 'trackId')",
);
const NOT_FOUND_ERROR = new Error('App not found (404)');

const makeAppStoreLib = (
  overrides: Partial<AppStoreLib> = {},
): AppStoreLib => ({
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

    it('does not retry an app the store does not have', async () => {
      const app = jest.fn().mockRejectedValue(NOT_FOUND_ERROR);
      const provider = new AppStoreProvider(makeAppStoreLib({ app }));

      await settle(provider.getApp('1', 'us'));

      expect(app).toHaveBeenCalledTimes(1);
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
      const app = jest.fn().mockRejectedValue(NOT_FOUND_ERROR);
      const provider = new GooglePlayProvider(makeGooglePlayLib({ app }));

      const error = await settle(provider.getApp('com.example', 'us'));

      expect(error).toBeInstanceOf(StoreAppNotFoundError);
      expect((error as StoreAppNotFoundError).store).toBe(Store.GOOGLE_PLAY);
      expect((error as StoreAppNotFoundError).storeAppId).toBe('com.example');
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
