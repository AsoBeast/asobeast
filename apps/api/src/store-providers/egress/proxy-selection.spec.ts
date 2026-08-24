import { Store } from '@prisma/client';
import {
  isGeoSensitive,
  PoolCandidate,
  selectEndpoint,
} from './proxy-selection';

const NOW = new Date('2026-08-08T10:00:00Z');

const candidate = (over: Partial<PoolCandidate>): PoolCandidate => ({
  endpointId: 'e1',
  country: 'us',
  cooldownUntil: null,
  lastUsedAt: null,
  ...over,
});

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const select = (candidates: PoolCandidate[], country?: string) =>
  selectEndpoint({ candidates, now: NOW, minIntervalMs: 4000, country });

describe('proxy selection', () => {
  it('reports an empty pool rather than inventing an endpoint', () => {
    expect(select([])).toEqual({ kind: 'empty' });
  });

  it('never picks an endpoint that is cooling down for this store', () => {
    const selection = select([
      candidate({ endpointId: 'burnt', cooldownUntil: at(30_000) }),
      candidate({ endpointId: 'healthy' }),
    ]);

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'healthy' });
  });

  it('waits for the earliest cooldown when the whole pool is burnt', () => {
    const selection = select([
      candidate({ endpointId: 'a', cooldownUntil: at(30_000) }),
      candidate({ endpointId: 'b', cooldownUntil: at(10_000) }),
    ]);

    expect(selection).toEqual({ kind: 'wait', waitMs: 10_000 });
  });

  it('spreads load onto the least recently used endpoint', () => {
    const selection = select([
      candidate({ endpointId: 'recent', lastUsedAt: at(-5_000) }),
      candidate({ endpointId: 'stale', lastUsedAt: at(-60_000) }),
    ]);

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'stale' });
  });

  it('prefers an endpoint that has never been used', () => {
    const selection = select([
      candidate({ endpointId: 'used', lastUsedAt: at(-60_000) }),
      candidate({ endpointId: 'fresh', lastUsedAt: null }),
    ]);

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'fresh' });
  });

  it('holds an endpoint back until its own rate window reopens', () => {
    const selection = select([
      candidate({ endpointId: 'hot', lastUsedAt: at(-1_000) }),
    ]);

    expect(selection).toEqual({ kind: 'wait', waitMs: 3_000 });
  });

  it('waits no longer than the endpoint that reopens first', () => {
    const selection = select([
      candidate({ endpointId: 'hot', lastUsedAt: at(-1_000) }),
      candidate({ endpointId: 'warm', lastUsedAt: at(-3_000) }),
    ]);

    expect(selection).toEqual({ kind: 'wait', waitMs: 1_000 });
  });

  it('prefers the target storefront when the pool has one', () => {
    const selection = select(
      [
        candidate({ endpointId: 'us-old', country: 'us', lastUsedAt: at(-1) }),
        candidate({ endpointId: 'de-any', country: 'de', lastUsedAt: null }),
      ],
      'de',
    );

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'de-any' });
  });

  it('falls back to any endpoint when the storefront is not represented', () => {
    const selection = select(
      [candidate({ endpointId: 'us-only', country: 'us' })],
      'jp',
    );

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'us-only' });
  });

  it('resolves ties deterministically so a restart keeps the same order', () => {
    const selection = select([
      candidate({ endpointId: 'b', lastUsedAt: null }),
      candidate({ endpointId: 'a', lastUsedAt: null }),
    ]);

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'a' });
  });

  it('treats a cooldown that has already passed as available', () => {
    const selection = select([
      candidate({ endpointId: 'recovered', cooldownUntil: at(-1) }),
    ]);

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'recovered' });
  });

  it('marks only the store that geolocates by egress address', () => {
    expect(isGeoSensitive(Store.GOOGLE_PLAY)).toBe(true);
    expect(isGeoSensitive(Store.APP_STORE)).toBe(false);
  });
});
