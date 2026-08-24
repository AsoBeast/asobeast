import { ProxyProtocol, Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { PoolShutdown } from './pool-shutdown';
import { ProxyPoolConfig } from './proxy-pool.config';
import {
  ProxyPool,
  ProxyPoolStoppingError,
  ProxyPoolUnavailableError,
} from './proxy-pool.service';

jest.mock('./egress', () => ({
  proxyDispatcher: jest.fn((origin: string) => ({
    origin,
    close: jest.fn(() => Promise.resolve()),
  })),
}));

import { proxyDispatcher } from './egress';

const dispatcherMock = proxyDispatcher as unknown as jest.Mock;

interface EndpointRow {
  id: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  country: string | null;
  credentialRef: string;
  health: {
    cooldownUntil: Date | null;
    pacedUntil: Date | null;
    lastUsedAt: Date | null;
  }[];
}

const endpoint = (over: Partial<EndpointRow> = {}): EndpointRow => ({
  id: 'e1',
  host: '10.0.0.1',
  port: 8080,
  protocol: ProxyProtocol.HTTP,
  country: 'us',
  credentialRef: 'env:PROXY_USERNAME',
  health: [],
  ...over,
});

const health = (over: Partial<EndpointRow['health'][number]> = {}) => ({
  cooldownUntil: null,
  pacedUntil: null,
  lastUsedAt: null,
  ...over,
});

describe('ProxyPool', () => {
  const findMany = jest.fn<Promise<EndpointRow[]>, []>();
  const queryRaw = jest.fn<Promise<{ endpointId: string }[]>, unknown[]>();

  const prisma = {
    proxyEndpoint: { findMany },
    $queryRaw: queryRaw,
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const configWith = (over: Partial<ProxyPoolConfig> = {}) =>
    ({
      enabled: true,
      minIntervalMs: 4_000,
      acquireTimeoutMs: 50,
      emptyPollMs: 10,
      credentialsFor: () => ({ username: 'pool', password: 'secret' }),
      ...over,
    }) as unknown as ProxyPoolConfig;

  const poolWith = (
    over: Partial<ProxyPoolConfig> = {},
    shutdown: PoolShutdown = new PoolShutdown(),
  ) => new ProxyPool(prisma, crossTenant, configWith(over), shutdown);

  const claimsEveryTime = () =>
    queryRaw.mockImplementation(() =>
      Promise.resolve([{ endpointId: 'claimed' }]),
    );

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    queryRaw.mockReset();
    claimsEveryTime();
    dispatcherMock.mockClear();
  });

  it('stays out of the way when no provider is configured', async () => {
    await expect(
      poolWith({ enabled: false }).acquire(Store.APP_STORE),
    ).resolves.toBeNull();

    expect(findMany).not.toHaveBeenCalled();
  });

  it('leases a dispatcher built from the endpoint address', async () => {
    findMany.mockResolvedValue([endpoint()]);

    const lease = await poolWith().acquire(Store.APP_STORE);

    expect(lease?.endpointId).toBe('e1');
    expect(dispatcherMock).toHaveBeenCalledWith('http://10.0.0.1:8080', {
      username: 'pool',
      password: 'secret',
    });
  });

  it('claims the endpoint in one conditional statement before leasing it', async () => {
    findMany.mockResolvedValue([endpoint()]);

    await poolWith().acquire(Store.GOOGLE_PLAY);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray)
      .join(' ')
      .replace(/\s+/g, ' ');
    expect(sql).toContain('INSERT INTO "ProxyHealth"');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('RETURNING');
  });

  it('moves to another endpoint when a concurrent worker claims the first', async () => {
    findMany.mockResolvedValue([
      endpoint({ id: 'a', host: '10.0.0.1' }),
      endpoint({
        id: 'b',
        host: '10.0.0.2',
        health: [health({ lastUsedAt: new Date(Date.now() - 60_000) })],
      }),
    ]);
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ endpointId: 'claimed' }]);

    const lease = await poolWith().acquire(Store.APP_STORE);

    expect(lease?.endpointId).toBe('b');
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('waits rather than leasing when every endpoint is claimed away', async () => {
    findMany.mockResolvedValue([endpoint()]);
    queryRaw.mockResolvedValue([]);

    await expect(
      poolWith({ acquireTimeoutMs: 20 }).acquire(Store.APP_STORE),
    ).rejects.toThrow(ProxyPoolUnavailableError);
  });

  it('stops waiting for an endpoint once the api is shutting down', async () => {
    findMany.mockResolvedValue([endpoint()]);
    queryRaw.mockResolvedValue([]);
    const shutdown = new PoolShutdown();
    shutdown.onModuleDestroy();

    const started = Date.now();
    await expect(
      poolWith(
        { acquireTimeoutMs: 120_000, emptyPollMs: 5_000 },
        shutdown,
      ).acquire(Store.APP_STORE),
    ).rejects.toThrow(ProxyPoolStoppingError);

    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('holds a paced endpoint back until its observed requests are spent', async () => {
    findMany.mockResolvedValue([
      endpoint({
        health: [health({ pacedUntil: new Date(Date.now() + 60_000) })],
      }),
    ]);

    await expect(
      poolWith({ acquireTimeoutMs: 20 }).acquire(Store.APP_STORE),
    ).rejects.toThrow(ProxyPoolUnavailableError);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reuses one dispatcher per endpoint instead of opening a pool per request', async () => {
    findMany.mockResolvedValue([endpoint()]);
    const pool = poolWith();

    const first = await pool.acquire(Store.APP_STORE);
    findMany.mockResolvedValue([endpoint()]);
    const second = await pool.acquire(Store.APP_STORE);

    expect(second?.dispatcher).toBe(first?.dispatcher);
    expect(dispatcherMock).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the dispatcher when the endpoint moves address', async () => {
    findMany.mockResolvedValue([endpoint()]);
    const pool = poolWith();
    await pool.acquire(Store.APP_STORE);

    findMany.mockResolvedValue([endpoint({ host: '10.0.0.2' })]);
    const moved = await pool.acquire(Store.APP_STORE);

    expect(dispatcherMock).toHaveBeenCalledTimes(2);
    expect(moved?.dispatcher).toEqual(
      expect.objectContaining({ origin: 'http://10.0.0.2:8080' }),
    );
  });

  it('waits for a slot rather than failing the job outright', async () => {
    findMany
      .mockResolvedValueOnce([
        endpoint({ health: [health({ lastUsedAt: new Date() })] }),
      ])
      .mockResolvedValue([endpoint()]);

    const lease = await poolWith({
      acquireTimeoutMs: 5_000,
    }).acquire(Store.APP_STORE);

    expect(lease?.endpointId).toBe('e1');
    expect(findMany.mock.calls.length).toBeGreaterThan(1);
  });

  it('gives up once the wait exceeds the acquire budget so bullmq can retry', async () => {
    findMany.mockResolvedValue([]);

    await expect(poolWith().acquire(Store.APP_STORE)).rejects.toThrow(
      ProxyPoolUnavailableError,
    );
  });

  it('prefers the storefront address only for the store that geolocates', async () => {
    const rows = [
      endpoint({ id: 'us', country: 'us', host: '10.0.0.1' }),
      endpoint({
        id: 'de',
        country: 'de',
        host: '10.0.0.2',
        health: [health({ lastUsedAt: new Date(Date.now() - 60_000) })],
      }),
    ];
    findMany.mockResolvedValue(rows);

    const play = await poolWith().acquire(Store.GOOGLE_PLAY, 'de');
    findMany.mockResolvedValue(rows);
    const apple = await poolWith().acquire(Store.APP_STORE, 'de');

    expect(play?.endpointId).toBe('de');
    expect(apple?.endpointId).toBe('us');
  });
});
