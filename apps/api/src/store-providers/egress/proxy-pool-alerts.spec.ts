import {
  ProxyOutcomeCounts,
  ProxyStoreHealth,
  ResidentialFallbackHealth,
} from '@asobeast/shared';
import { poolAlerts } from './proxy-pool-alerts';

const noOutcomes = (): ProxyOutcomeCounts => ({
  SUCCESS: 0,
  TRANSPORT: 0,
  RATE_LIMITED: 0,
  BLOCKED: 0,
  SILENT: 0,
});

const store = (over: Partial<ProxyStoreHealth> = {}): ProxyStoreHealth => ({
  store: 'APP_STORE',
  endpoints: 100,
  healthy: 100,
  coolingDown: 0,
  successRate: 1,
  outcomes: noOutcomes(),
  requestsLastHour: 0,
  capacityPerHour: 90_000,
  ...over,
});

const residential = (
  over: Partial<ResidentialFallbackHealth> = {},
): ResidentialFallbackHealth => ({
  configured: true,
  month: '2026-08',
  requests: 0,
  spendUsd: 0,
  capUsd: 10,
  fallbackRate: 0,
  ...over,
});

describe('poolAlerts', () => {
  it('stays quiet on a healthy pool', () => {
    expect(
      poolAlerts({ stores: [store()], residential: residential() }),
    ).toEqual([]);
  });

  it('raises the pool alert once most endpoints are cooling down', () => {
    expect(
      poolAlerts({
        stores: [store({ healthy: 20, coolingDown: 80 })],
        residential: residential(),
      }),
    ).toContain('pool.healthy.low');
  });

  it('raises the block alert as the burnt share grows', () => {
    expect(
      poolAlerts({
        stores: [store({ outcomes: { ...noOutcomes(), BLOCKED: 10 } })],
        residential: residential(),
      }),
    ).toContain('pool.blocked.rising');
  });

  it('raises the silent failure alert on a single detection in a hundred', () => {
    expect(
      poolAlerts({
        stores: [store({ outcomes: { ...noOutcomes(), SILENT: 1 } })],
        residential: residential(),
      }),
    ).toContain('pool.silent.rising');
  });

  it('warns before residential spend reaches the cap', () => {
    expect(
      poolAlerts({
        stores: [store()],
        residential: residential({ spendUsd: 8, capUsd: 10 }),
      }),
    ).toContain('residential.spend.near-cap');
  });

  it('says nothing about spend when no residential budget exists', () => {
    expect(
      poolAlerts({
        stores: [store()],
        residential: residential({ spendUsd: 0, capUsd: 0 }),
      }),
    ).toEqual([]);
  });

  it('ignores a store with no endpoints rather than calling it unhealthy', () => {
    expect(
      poolAlerts({
        stores: [store({ endpoints: 0, healthy: 0 })],
        residential: residential(),
      }),
    ).toEqual([]);
  });

  it('reports each alert once across both stores', () => {
    const alerts = poolAlerts({
      stores: [
        store({ healthy: 10 }),
        store({ store: 'GOOGLE_PLAY', healthy: 10 }),
      ],
      residential: residential(),
    });

    expect(alerts).toEqual(['pool.healthy.low']);
  });
});
