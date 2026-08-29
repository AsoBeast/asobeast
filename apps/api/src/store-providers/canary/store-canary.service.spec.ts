import { Queue } from 'bullmq';
import { Store } from '@prisma/client';
import { StoreAppNotFoundError, StoreRequestError } from '../errors';
import { ProxyEgress } from '../egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-provider.registry';
import { NormalizedApp, SearchItem, StoreProvider } from '../types';
import { storeCanaryKey } from '../../jobs/jobs.types';
import {
  CANARY_TARGETS,
  StoreCanaryRecord,
  StoreCanaryService,
} from './store-canary.service';

function appOf(store: Store, overrides: Partial<NormalizedApp> = {}) {
  return {
    store,
    storeAppId: CANARY_TARGETS[store].storeAppId,
    title: 'Facebook',
    description: 'Connect with friends.',
    raw: {},
    ...overrides,
  } satisfies NormalizedApp;
}

const RESULTS: SearchItem[] = [{ storeAppId: '1', title: 'Photo Editor' }];

type ProviderStub = Pick<StoreProvider, 'getApp' | 'search'>;

function build(stored: Record<string, string> = {}) {
  const redis = new Map(Object.entries(stored));
  const client = {
    get: jest.fn((key: string) => Promise.resolve(redis.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      redis.set(key, value);
      return Promise.resolve('OK');
    }),
  };
  const providers: Record<Store, ProviderStub> = {
    APP_STORE: {
      getApp: jest.fn(() => Promise.resolve(appOf(Store.APP_STORE))),
      search: jest.fn(() => Promise.resolve(RESULTS)),
    },
    GOOGLE_PLAY: {
      getApp: jest.fn(() => Promise.resolve(appOf(Store.GOOGLE_PLAY))),
      search: jest.fn(() => Promise.resolve(RESULTS)),
    },
  };
  const registry = {
    get: jest.fn((store: Store) => providers[store]),
  };
  const egress = {
    through: jest.fn(
      (
        _store: Store,
        _country: string | undefined,
        work: () => Promise<unknown>,
      ) => work(),
    ),
  };
  const queue = {
    getBackend: () => ({ client: Promise.resolve(client) }),
  };
  const service = new StoreCanaryService(
    registry as unknown as StoreProviderRegistry,
    egress as unknown as ProxyEgress,
    queue as unknown as Queue,
  );
  return { service, providers, registry, egress, client, redis };
}

function written(redis: Map<string, string>, store: Store): StoreCanaryRecord {
  return JSON.parse(redis.get(storeCanaryKey(store))!) as StoreCanaryRecord;
}

function recordOf(overrides: Partial<StoreCanaryRecord> = {}): string {
  return JSON.stringify({
    outcome: 'broken',
    detail: 'parsed app is missing title',
    checkedAt: '2026-08-28T02:00:00.000Z',
    failingSince: '2026-08-28T02:00:00.000Z',
    consecutiveFailures: 1,
    ...overrides,
  });
}

describe('StoreCanaryService', () => {
  it('records ok for every store when both checks parse', async () => {
    const { service, redis } = build();

    const records = await service.run();

    expect(records.APP_STORE.outcome).toBe('ok');
    expect(records.GOOGLE_PLAY.outcome).toBe('ok');
    expect(written(redis, Store.APP_STORE)).toMatchObject({
      outcome: 'ok',
      detail: null,
      failingSince: null,
      consecutiveFailures: 0,
    });
  });

  it('spends the pool budget by running every request through egress', async () => {
    const { service, egress } = build();

    await service.run();

    expect(egress.through).toHaveBeenCalledTimes(4);
    expect(egress.through.mock.calls.map(([store]) => store)).toEqual([
      Store.APP_STORE,
      Store.APP_STORE,
      Store.GOOGLE_PLAY,
      Store.GOOGLE_PLAY,
    ]);
  });

  it('probes the ids the smoke check already exercises', async () => {
    const { service, providers } = build();

    await service.run();

    expect(providers.APP_STORE.getApp).toHaveBeenCalledWith('284882215', 'us');
    expect(providers.GOOGLE_PLAY.getApp).toHaveBeenCalledWith(
      'com.facebook.katana',
      'us',
    );
  });

  it('records a shape failure as a first broken run', async () => {
    const { service, providers, redis } = build();
    providers.APP_STORE.getApp = jest.fn(() =>
      Promise.resolve(appOf(Store.APP_STORE, { title: '' })),
    );

    const records = await service.run();

    expect(records.APP_STORE).toMatchObject({
      outcome: 'broken',
      detail: 'parsed app is missing title',
      consecutiveFailures: 1,
    });
    expect(records.APP_STORE.failingSince).toBe(records.APP_STORE.checkedAt);
    expect(written(redis, Store.APP_STORE).consecutiveFailures).toBe(1);
  });

  it('counts a second consecutive break without moving failingSince', async () => {
    const { service, providers } = build({
      [storeCanaryKey(Store.APP_STORE)]: recordOf(),
    });
    providers.APP_STORE.search = jest.fn(() => Promise.resolve([]));

    const records = await service.run();

    expect(records.APP_STORE).toMatchObject({
      outcome: 'broken',
      detail: 'search returned no results',
      consecutiveFailures: 2,
      failingSince: '2026-08-28T02:00:00.000Z',
    });
  });

  it('resets the count for a transport failure rather than blaming the parser', async () => {
    const { service, providers } = build({
      [storeCanaryKey(Store.APP_STORE)]: recordOf(),
    });
    providers.APP_STORE.getApp = jest.fn(() =>
      Promise.reject(
        new StoreRequestError(Store.APP_STORE, 'getApp', 'socket hang up'),
      ),
    );

    const records = await service.run();

    expect(records.APP_STORE).toMatchObject({
      outcome: 'unreachable',
      consecutiveFailures: 0,
      failingSince: null,
    });
  });

  it('reports a delisted canary target as missing, not broken', async () => {
    const { service, providers } = build({
      [storeCanaryKey(Store.GOOGLE_PLAY)]: recordOf(),
    });
    providers.GOOGLE_PLAY.getApp = jest.fn(() =>
      Promise.reject(
        new StoreAppNotFoundError(Store.GOOGLE_PLAY, 'com.facebook.katana'),
      ),
    );

    const records = await service.run();

    expect(records.GOOGLE_PLAY).toMatchObject({
      outcome: 'target-missing',
      consecutiveFailures: 0,
      failingSince: null,
    });
  });

  it('clears failingSince once a store parses again', async () => {
    const { service } = build({
      [storeCanaryKey(Store.APP_STORE)]: recordOf({ consecutiveFailures: 2 }),
    });

    const records = await service.run();

    expect(records.APP_STORE).toMatchObject({
      outcome: 'ok',
      failingSince: null,
      consecutiveFailures: 0,
    });
  });

  it('leaves the healthy store untouched when the other one breaks', async () => {
    const { service, providers, redis } = build();
    providers.APP_STORE.search = jest.fn(() => Promise.resolve([]));

    await service.run();

    expect(written(redis, Store.APP_STORE).outcome).toBe('broken');
    expect(written(redis, Store.GOOGLE_PLAY).outcome).toBe('ok');
  });

  it('reads back what it wrote', async () => {
    const { service } = build();

    await service.run();

    expect(await service.records()).toMatchObject({
      APP_STORE: { outcome: 'ok' },
      GOOGLE_PLAY: { outcome: 'ok' },
    });
  });

  it('treats an unreadable stored record as no record at all', async () => {
    const { service } = build({
      [storeCanaryKey(Store.APP_STORE)]: 'not json',
      [storeCanaryKey(Store.GOOGLE_PLAY)]: JSON.stringify({ outcome: 'nope' }),
    });

    expect(await service.records()).toEqual({});
  });
});
