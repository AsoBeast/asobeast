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
  pacedUntil: null,
  lastUsedAt: null,
  ...over,
});

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const LEASE_HOLD = 5 * 60_000;

const select = (
  candidates: PoolCandidate[],
  country?: string,
  waitForLocal?: boolean,
) =>
  selectEndpoint({
    candidates,
    now: NOW,
    minIntervalMs: 4000,
    country,
    waitForLocal,
  });

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

  it('waits for a busy local endpoint instead of sending the search abroad', () => {
    const selection = select(
      [
        candidate({
          endpointId: 'de-busy',
          country: 'de',
          lastUsedAt: at(-1_000),
        }),
        candidate({ endpointId: 'us-free', country: 'us', lastUsedAt: null }),
      ],
      'de',
    );

    expect(selection).toEqual({ kind: 'wait', waitMs: 3_000 });
  });

  it('takes a free foreign endpoint when told not to wait for a busy local one', () => {
    const selection = select(
      [
        candidate({
          endpointId: 'de-busy',
          country: 'de',
          pacedUntil: at(60_000),
        }),
        candidate({ endpointId: 'us-free', country: 'us' }),
      ],
      'de',
      false,
    );

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'us-free' });
  });

  it('still prefers a free local endpoint when told not to wait', () => {
    const selection = select(
      [
        candidate({ endpointId: 'us-free', country: 'us' }),
        candidate({
          endpointId: 'de-free',
          country: 'de',
          lastUsedAt: at(-60_000),
        }),
      ],
      'de',
      false,
    );

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'de-free' });
  });

  it('waits for a paced local endpoint while a foreign one is free', () => {
    const selection = select(
      [
        candidate({
          endpointId: 'de-paced',
          country: 'de',
          pacedUntil: at(8_000),
        }),
        candidate({ endpointId: 'us-free', country: 'us' }),
      ],
      'de',
    );

    expect(selection).toEqual({ kind: 'wait', waitMs: 8_000 });
  });

  it('waits only for the healthy local endpoints when another is cooling down', () => {
    const selection = select(
      [
        candidate({
          endpointId: 'de-burnt',
          country: 'de',
          cooldownUntil: at(60_000),
        }),
        candidate({
          endpointId: 'de-busy',
          country: 'de',
          lastUsedAt: at(-2_000),
        }),
        candidate({ endpointId: 'us-free', country: 'us' }),
      ],
      'de',
    );

    expect(selection).toEqual({ kind: 'wait', waitMs: 2_000 });
  });

  it('falls back to a foreign endpoint once every local one is cooling down', () => {
    const selection = select(
      [
        candidate({
          endpointId: 'de-burnt',
          country: 'de',
          cooldownUntil: at(60_000),
        }),
        candidate({ endpointId: 'us-free', country: 'us' }),
      ],
      'de',
    );

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'us-free' });
  });

  it('spreads load across the free local endpoints', () => {
    const selection = select(
      [
        candidate({
          endpointId: 'de-recent',
          country: 'de',
          lastUsedAt: at(-5_000),
        }),
        candidate({
          endpointId: 'de-stale',
          country: 'de',
          lastUsedAt: at(-60_000),
        }),
        candidate({ endpointId: 'us-fresh', country: 'us', lastUsedAt: null }),
      ],
      'de',
    );

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'de-stale' });
  });

  it('takes any free endpoint when no storefront is asked for', () => {
    const selection = select([
      candidate({
        endpointId: 'de-busy',
        country: 'de',
        lastUsedAt: at(-1_000),
      }),
      candidate({ endpointId: 'us-free', country: 'us' }),
    ]);

    expect(selection).toEqual({ kind: 'endpoint', endpointId: 'us-free' });
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

  describe('reserve', () => {
    const held = at(LEASE_HOLD);
    const keep = (
      candidates: PoolCandidate[],
      reserve: number,
      country?: string,
    ) =>
      selectEndpoint({
        candidates,
        now: NOW,
        minIntervalMs: 4000,
        country,
        waitForLocal: true,
        reserve,
      });

    it('keeps the reserve free of a caller that must leave it', () => {
      expect(
        keep(
          [candidate({ endpointId: 'a' }), candidate({ endpointId: 'b' })],
          1,
        ),
      ).toEqual({ kind: 'endpoint', endpointId: 'a' });
    });

    it('waits when taking one would leave less than the reserve', () => {
      expect(
        keep(
          [
            candidate({ endpointId: 'free' }),
            candidate({ endpointId: 'held', pacedUntil: held }),
          ],
          1,
        ),
      ).toEqual({ kind: 'wait', waitMs: LEASE_HOLD });
    });

    it('lets reserve zero take the last free endpoint', () => {
      expect(
        keep(
          [
            candidate({ endpointId: 'free' }),
            candidate({ endpointId: 'held', pacedUntil: held }),
          ],
          0,
        ),
      ).toEqual({ kind: 'endpoint', endpointId: 'free' });
    });

    it('ignores the reserve when the healthy pool is no larger', () => {
      expect(keep([candidate({ endpointId: 'only' })], 1)).toEqual({
        kind: 'endpoint',
        endpointId: 'only',
      });
    });

    it('counts only healthy endpoints toward the pool size', () => {
      expect(
        keep(
          [
            candidate({ endpointId: 'free' }),
            candidate({ endpointId: 'burnt', cooldownUntil: at(30_000) }),
          ],
          1,
        ),
      ).toEqual({ kind: 'endpoint', endpointId: 'free' });
    });

    it('counts the whole store, not the storefront', () => {
      expect(
        keep(
          [
            candidate({ endpointId: 'de', country: 'de' }),
            candidate({ endpointId: 'us', country: 'us' }),
          ],
          1,
          'us',
        ),
      ).toEqual({ kind: 'endpoint', endpointId: 'us' });
    });

    it('keeps the last free endpoint even when it is abroad', () => {
      expect(
        keep(
          [
            candidate({ endpointId: 'de', country: 'de' }),
            candidate({ endpointId: 'us', country: 'us', pacedUntil: held }),
          ],
          1,
          'us',
        ),
      ).toEqual({ kind: 'wait', waitMs: LEASE_HOLD });
    });

    it('waits for the endpoint that opens beyond the reserve', () => {
      expect(
        keep(
          [
            candidate({ endpointId: 'free' }),
            candidate({ endpointId: 'soon', pacedUntil: at(10_000) }),
            candidate({ endpointId: 'later', pacedUntil: at(30_000) }),
          ],
          1,
        ),
      ).toEqual({ kind: 'wait', waitMs: 10_000 });
    });
  });
});
