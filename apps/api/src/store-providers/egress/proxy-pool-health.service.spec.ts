import { ProxyOutcome, Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { ProxyLedger } from './proxy-ledger.service';
import { ProxyPoolHealthReport } from './proxy-pool-health.service';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ResidentialFallback } from './residential-fallback.service';

const NOW = new Date('2026-08-08T10:00:00Z');

interface HealthRow {
  store: Store;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  cooldownUntil: Date | null;
  lastOutcome: ProxyOutcome | null;
  lastUsedAt: Date | null;
}

const health = (over: Partial<HealthRow> = {}): HealthRow => ({
  store: Store.APP_STORE,
  successes: 9,
  failures: 1,
  consecutiveFailures: 0,
  cooldownUntil: null,
  lastOutcome: ProxyOutcome.SUCCESS,
  lastUsedAt: NOW,
  ...over,
});

const endpoint = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  host: '10.0.0.1',
  port: 8080,
  country: 'us',
  enabled: true,
  retiredAt: null,
  health: [health()],
  ...over,
});

describe('ProxyPoolHealthReport', () => {
  const findMany = jest.fn<Promise<ReturnType<typeof endpoint>[]>, []>();
  const count = jest.fn<Promise<number>, []>();
  const spend = jest.fn();

  const prisma = {
    proxyEndpoint: { findMany },
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const report = new ProxyPoolHealthReport(
    prisma,
    crossTenant,
    {
      enabled: true,
      provider: 'webshare',
      endpointRpm: 15,
    } as unknown as ProxyPoolConfig,
    { configured: true, spend } as unknown as ResidentialFallback,
    { count } as unknown as ProxyLedger,
  );

  const appStore = async () => {
    const built = await report.build(NOW);
    return built.stores.find((row) => row.store === 'APP_STORE');
  };

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([endpoint()]);
    count.mockReset().mockResolvedValue(99);
    spend.mockReset().mockResolvedValue({
      month: '2026-08',
      requests: 1,
      usd: 0.5,
      capUsd: 10,
    });
  });

  it('separates serving endpoints from pending and retired ones', async () => {
    findMany.mockResolvedValue([
      endpoint({ id: 'serving' }),
      endpoint({ id: 'pending', enabled: false }),
      endpoint({ id: 'gone', retiredAt: NOW }),
    ]);

    const built = await report.build(NOW);

    expect(built).toMatchObject({ total: 2, pending: 1, retired: 1 });
  });

  it('counts an endpoint in cooldown as unavailable for that store only', async () => {
    findMany.mockResolvedValue([
      endpoint({
        health: [
          health({ cooldownUntil: new Date(NOW.getTime() + 60_000) }),
          health({ store: Store.GOOGLE_PLAY }),
        ],
      }),
    ]);

    const built = await report.build(NOW);
    const byStore = new Map(built.stores.map((row) => [row.store, row]));

    expect(byStore.get('APP_STORE')).toMatchObject({
      healthy: 0,
      coolingDown: 1,
    });
    expect(byStore.get('GOOGLE_PLAY')).toMatchObject({
      healthy: 1,
      coolingDown: 0,
    });
  });

  it('reports the success rate over the rolling window', async () => {
    expect(await appStore()).toMatchObject({
      successRate: 0.9,
      requestsLastHour: 10,
    });
  });

  it('prices capacity from the per-endpoint rate limit', async () => {
    expect((await appStore())?.capacityPerHour).toBe(900);
  });

  it('shows the shape of the failures, not only the total', async () => {
    findMany.mockResolvedValue([
      endpoint({
        id: 'a',
        health: [health({ lastOutcome: ProxyOutcome.BLOCKED })],
      }),
      endpoint({
        id: 'b',
        health: [health({ lastOutcome: ProxyOutcome.SILENT })],
      }),
    ]);

    expect((await appStore())?.outcomes).toMatchObject({
      BLOCKED: 1,
      SILENT: 1,
      SUCCESS: 0,
    });
  });

  it('reports residential fallback as a share of all egress', async () => {
    const built = await report.build(NOW);

    expect(built.residential).toMatchObject({
      configured: true,
      requests: 1,
      spendUsd: 0.5,
      capUsd: 10,
      fallbackRate: 0.01,
    });
  });

  it('raises the alerts the pool shape earns', async () => {
    findMany.mockResolvedValue([
      endpoint({
        id: 'a',
        health: [health({ lastOutcome: ProxyOutcome.SILENT })],
      }),
    ]);

    const built = await report.build(NOW);

    expect(built.alerts).toContain('pool.silent.rising');
  });
});
