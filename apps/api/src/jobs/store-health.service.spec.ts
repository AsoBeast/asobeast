import { Queue } from 'bullmq';
import type { StoreHealth, StoreHealthReport } from '@asobeast/shared';
import { Store } from '@prisma/client';
import { storeCanaryKey } from './jobs.types';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import {
  CANARY_CONFIRMATIONS,
  StoreCanaryRecord,
  StoreCanaryService,
} from '../store-providers/canary/store-canary.service';
import type { PublishedStoreStatus } from '../store-providers/canary/published-status';
import { PublishedStatusService } from '../store-providers/canary/published-status.service';
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
  published: () => Promise<Partial<Record<Store, PublishedStoreStatus>>> = () =>
    Promise.resolve({}),
) {
  return new StoreHealthService(
    { records } as unknown as StoreCanaryService,
    { published } as unknown as PublishedStatusService,
  );
}

function appStore(report: StoreHealthReport): StoreHealth | undefined {
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

  it('keeps the egress failure text off an authenticated tenant route', async () => {
    const report = await build(() =>
      Promise.resolve({
        APP_STORE: recordOf({
          outcome: 'unreachable',
          detail:
            'APP_STORE getApp failed: connect EHOSTUNREACH 203.0.113.7:8080',
        }),
      }),
    ).report();

    expect(JSON.stringify(report)).not.toContain('203.0.113.7');
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
      detail: null,
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

    const report = await new StoreHealthService(canary, {
      published: () => Promise.resolve({}),
    } as unknown as PublishedStatusService).report();

    expect(report.stores.map((store) => store.state)).toEqual([
      'unknown',
      'broken',
    ]);
  });

  describe('with a published status document', () => {
    const announced: PublishedStoreStatus = {
      state: 'broken',
      since: '2026-08-28T01:00:00.000Z',
      summary: 'Google Play changed the shape of its search response.',
    };

    it('lets the maintainer name a break this machine has not confirmed', async () => {
      const report = await build(
        () => Promise.resolve({ APP_STORE: recordOf() }),
        () => Promise.resolve({ APP_STORE: announced }),
      ).report();

      expect(appStore(report)).toMatchObject({
        state: 'broken',
        source: 'published',
        since: announced.since,
        detail: announced.summary,
        checkedAt: CHECKED_AT,
      });
      expect(report.degraded).toBe(true);
    });

    it('surfaces a published break on a store with no canary record at all', async () => {
      const report = await build(
        () => Promise.resolve({}),
        () => Promise.resolve({ APP_STORE: announced }),
      ).report();

      expect(appStore(report)).toMatchObject({
        state: 'broken',
        source: 'published',
        checkedAt: null,
      });
    });

    it('lets the published sentence win the source and the detail when both fire', async () => {
      const report = await build(
        () => Promise.resolve({ APP_STORE: BROKEN }),
        () => Promise.resolve({ APP_STORE: announced }),
      ).report();

      expect(appStore(report)).toMatchObject({
        state: 'broken',
        source: 'published',
        detail: announced.summary,
      });
    });

    it('keeps a local break when the document says the store is fine', async () => {
      const report = await build(
        () => Promise.resolve({ APP_STORE: BROKEN }),
        () =>
          Promise.resolve({
            APP_STORE: { state: 'ok', since: null, summary: null } as const,
          }),
      ).report();

      expect(appStore(report)).toMatchObject({
        state: 'broken',
        source: 'canary',
        detail: 'parsed app is missing title',
      });
    });

    it('reports the canary state when the document names no store', async () => {
      const report = await build(
        () =>
          Promise.resolve({
            APP_STORE: recordOf({ outcome: 'unreachable', detail: 'timeout' }),
          }),
        () => Promise.resolve({}),
      ).report();

      expect(appStore(report)).toMatchObject({
        state: 'unreachable',
        source: 'canary',
      });
    });

    it('falls back to the canary start time when the document carries none', async () => {
      const report = await build(
        () => Promise.resolve({ APP_STORE: BROKEN }),
        () => Promise.resolve({ APP_STORE: { ...announced, since: null } }),
      ).report();

      expect(appStore(report)?.since).toBe(FAILING_SINCE);
    });

    it('reports the canary state when the published read fails', async () => {
      const report = await build(
        () => Promise.resolve({ APP_STORE: BROKEN }),
        () => Promise.reject(new Error('redis is down')),
      ).report();

      expect(appStore(report)).toMatchObject({
        state: 'broken',
        source: 'canary',
      });
    });
  });
});
