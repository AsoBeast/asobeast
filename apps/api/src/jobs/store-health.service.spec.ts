import { Queue } from 'bullmq';
import { Store } from '@prisma/client';
import { storeCanaryKey } from './jobs.types';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import {
  CANARY_CONFIRMATIONS,
  StoreCanaryRecord,
  StoreCanaryService,
} from '../store-providers/canary/store-canary.service';
import { StoreHealthService } from './store-health.service';

const CHECKED_AT = '2026-08-28T08:00:00.000Z';
const FAILING_SINCE = '2026-08-28T02:00:00.000Z';

function recordOf(
  overrides: Partial<StoreCanaryRecord> = {},
): StoreCanaryRecord {
  return {
    outcome: 'ok',
    detail: null,
    checkedAt: CHECKED_AT,
    failingSince: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

const BROKEN = recordOf({
  outcome: 'broken',
  detail: 'parsed app is missing title',
  failingSince: FAILING_SINCE,
  consecutiveFailures: CANARY_CONFIRMATIONS,
});

function build(
  records: () => Promise<Partial<Record<Store, StoreCanaryRecord>>>,
) {
  return new StoreHealthService({ records } as unknown as StoreCanaryService);
}

function appStore(report: { stores: { store: string }[] }) {
  return report.stores.find((store) => store.store === 'APP_STORE');
}

describe('StoreHealthService', () => {
  it('reports a store the canary parsed as ok', async () => {
    const report = await build(() =>
      Promise.resolve({ APP_STORE: recordOf() }),
    ).report();

    expect(appStore(report)).toEqual({
      store: 'APP_STORE',
      state: 'ok',
      source: 'canary',
      since: null,
      checkedAt: CHECKED_AT,
      detail: null,
    });
    expect(report.degraded).toBe(false);
  });

  it('reports a confirmed break with the time it started', async () => {
    const report = await build(() =>
      Promise.resolve({ APP_STORE: BROKEN }),
    ).report();

    expect(appStore(report)).toEqual({
      store: 'APP_STORE',
      state: 'broken',
      source: 'canary',
      since: FAILING_SINCE,
      checkedAt: CHECKED_AT,
      detail: 'parsed app is missing title',
    });
    expect(report.degraded).toBe(true);
  });

  it('holds an unconfirmed break at ok rather than crying wolf', async () => {
    const report = await build(() =>
      Promise.resolve({
        APP_STORE: { ...BROKEN, consecutiveFailures: CANARY_CONFIRMATIONS - 1 },
      }),
    ).report();

    expect(appStore(report)).toMatchObject({
      state: 'ok',
      since: null,
      detail: null,
      checkedAt: CHECKED_AT,
    });
    expect(report.degraded).toBe(false);
  });

  it('separates an unreachable store from a broken parser', async () => {
    const report = await build(() =>
      Promise.resolve({
        APP_STORE: recordOf({
          outcome: 'unreachable',
          detail: 'APP_STORE getApp failed: socket hang up',
        }),
      }),
    ).report();

    expect(appStore(report)).toMatchObject({
      state: 'unreachable',
      since: null,
      detail: 'APP_STORE getApp failed: socket hang up',
    });
    expect(report.degraded).toBe(false);
  });

  it('reports a delisted canary target as unknown, because it cannot answer', async () => {
    const report = await build(() =>
      Promise.resolve({
        APP_STORE: recordOf({ outcome: 'target-missing', detail: 'gone' }),
      }),
    ).report();

    expect(appStore(report)).toMatchObject({ state: 'unknown', detail: null });
  });

  it('reports every store the canary has never run for as unknown', async () => {
    const report = await build(() => Promise.resolve({})).report();

    expect(report.stores.map((store) => store.state)).toEqual([
      'unknown',
      'unknown',
    ]);
    expect(report.stores.map((store) => store.checkedAt)).toEqual([null, null]);
  });

  it('degrades to unknown rather than failing when redis does not answer', async () => {
    const report = await build(() =>
      Promise.reject(new Error('redis is down')),
    ).report();

    expect(report).toEqual({
      stores: [
        {
          store: 'APP_STORE',
          state: 'unknown',
          source: 'canary',
          since: null,
          checkedAt: null,
          detail: null,
        },
        {
          store: 'GOOGLE_PLAY',
          state: 'unknown',
          source: 'canary',
          since: null,
          checkedAt: null,
          detail: null,
        },
      ],
      degraded: false,
    });
  });

  it('answers for both stores from one read', async () => {
    const report = await build(() =>
      Promise.resolve({ APP_STORE: BROKEN, GOOGLE_PLAY: recordOf() }),
    ).report();

    expect(report.stores.map((store) => store.state)).toEqual(['broken', 'ok']);
  });

  it('reads a record an older version wrote as unknown rather than throwing', async () => {
    const stored = new Map([
      [storeCanaryKey(Store.APP_STORE), '{"outcome":'],
      [storeCanaryKey(Store.GOOGLE_PLAY), JSON.stringify(BROKEN)],
    ]);
    const canary = new StoreCanaryService(
      {} as StoreProviderRegistry,
      {} as ProxyEgress,
      {
        getBackend: () => ({
          client: Promise.resolve({
            get: (key: string) => Promise.resolve(stored.get(key) ?? null),
          }),
        }),
      } as unknown as Queue,
    );

    const report = await new StoreHealthService(canary).report();

    expect(report.stores.map((store) => store.state)).toEqual([
      'unknown',
      'broken',
    ]);
  });
});
