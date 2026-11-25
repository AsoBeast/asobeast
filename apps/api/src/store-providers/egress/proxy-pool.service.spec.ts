import { ProxyProtocol, Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { StorePoolBusyError, StoreRequestError } from '../errors';
import { withinStoreDeadline } from '../store-deadline';
import { PoolShutdown } from './pool-shutdown';
import { ProxyPoolConfig } from './proxy-pool.config';
import {
  LEASE_HOLD_MS,
  ProxyAccountRefusedError,
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
  const updateMany = jest.fn<Promise<{ count: number }>, [unknown]>();

  const prisma = {
    proxyEndpoint: { findMany },
    proxyHealth: { updateMany },
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
      pollMs: 10,
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
    updateMany.mockReset().mockResolvedValue({ count: 1 });
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

  it('holds the endpoint it leases until the job releases it', async () => {
    findMany.mockResolvedValue([endpoint()]);
    const before = Date.now();

    const lease = await poolWith().acquire(Store.GOOGLE_PLAY);

    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray)
      .join(' ')
      .replace(/\s+/g, ' ');
    expect(sql).toContain('"pacedUntil" =');
    expect(queryRaw.mock.calls[0]).toContainEqual(
      new Date((lease?.leasedAt.getTime() ?? 0) + LEASE_HOLD_MS),
    );
    expect(lease?.leasedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('paces a released endpoint only while its lease still owns it', async () => {
    const leasedAt = new Date();
    const until = new Date(Date.now() + 8_000);

    await poolWith().release('e1', Store.GOOGLE_PLAY, { leasedAt, until });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        endpointId: 'e1',
        store: Store.GOOGLE_PLAY,
        lastUsedAt: leasedAt,
      },
      data: { pacedUntil: until },
    });
  });

  it('looks again at the poll interval while every endpoint is held', async () => {
    findMany
      .mockResolvedValueOnce([
        endpoint({
          health: [
            health({ pacedUntil: new Date(Date.now() + LEASE_HOLD_MS) }),
          ],
        }),
      ])
      .mockResolvedValue([endpoint()]);
    const started = Date.now();

    const lease = await poolWith({
      acquireTimeoutMs: 5_000,
      pollMs: 10,
    }).acquire(Store.GOOGLE_PLAY);

    expect(lease?.endpointId).toBe('e1');
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(1_000);
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
      poolWith({ acquireTimeoutMs: 120_000, pollMs: 5_000 }, shutdown).acquire(
        Store.APP_STORE,
      ),
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

  it('waits for a local endpoint another worker claimed instead of leasing a foreign one', async () => {
    findMany.mockResolvedValue([
      endpoint({ id: 'de', country: 'de', host: '10.0.0.2' }),
      endpoint({ id: 'us', country: 'us', host: '10.0.0.1' }),
    ]);
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ endpointId: 'claimed' }]);

    const lease = await poolWith({
      minIntervalMs: 5,
      acquireTimeoutMs: 5_000,
    }).acquire(Store.GOOGLE_PLAY, 'de');

    expect(lease?.endpointId).toBe('de');
    expect(queryRaw.mock.calls.map((call) => call.includes('de'))).toEqual([
      true,
      true,
    ]);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('takes a free foreign endpoint rather than wait for a busy local one when told to', async () => {
    findMany.mockResolvedValue([
      endpoint({
        id: 'de',
        country: 'de',
        host: '10.0.0.2',
        health: [health({ pacedUntil: new Date(Date.now() + LEASE_HOLD_MS) })],
      }),
      endpoint({ id: 'us', country: 'us', host: '10.0.0.1' }),
    ]);

    const lease = await poolWith().acquire(Store.GOOGLE_PLAY, 'de', false);

    expect(lease?.endpointId).toBe('us');
  });

  it('stops waiting for an endpoint once the on demand deadline passes', async () => {
    findMany.mockResolvedValue([]);
    const started = Date.now();

    const failure = await withinStoreDeadline(
      () =>
        poolWith({ acquireTimeoutMs: 120_000, pollMs: 5_000 })
          .acquire(Store.APP_STORE)
          .catch((error: unknown) => error),
      30,
    );

    expect(failure).toBeInstanceOf(StoreRequestError);
    expect((failure as StoreRequestError).userMessage).toBe(
      'This server is busy reaching the App Store. Try again in 5 seconds.',
    );
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  describe('with an interactive reserve', () => {
    const twoFreeOneHeld = () =>
      findMany.mockResolvedValue([
        endpoint({ id: 'a', host: '10.0.0.1' }),
        endpoint({ id: 'b', host: '10.0.0.2' }),
        endpoint({
          id: 'held',
          host: '10.0.0.3',
          health: [
            health({ pacedUntil: new Date(Date.now() + LEASE_HOLD_MS) }),
          ],
        }),
      ]);

    it('lets queued work lease while the reserve stays free', async () => {
      twoFreeOneHeld();

      const lease = await poolWith({ interactiveReserve: 1 }).acquire(
        Store.GOOGLE_PLAY,
        'us',
      );

      expect(lease?.endpointId).toBe('a');
    });

    it('passes the reserve only to queued work', async () => {
      findMany.mockResolvedValue([
        endpoint({ id: 'free', host: '10.0.0.1' }),
        endpoint({
          id: 'held',
          host: '10.0.0.2',
          health: [
            health({ pacedUntil: new Date(Date.now() + LEASE_HOLD_MS) }),
          ],
        }),
      ]);
      const pool = poolWith({ interactiveReserve: 1, acquireTimeoutMs: 50 });

      await expect(pool.acquire(Store.GOOGLE_PLAY, 'us')).rejects.toThrow(
        ProxyPoolUnavailableError,
      );
      const waited = await withinStoreDeadline(() =>
        pool.acquire(Store.GOOGLE_PLAY, 'us'),
      );
      expect(waited?.endpointId).toBe('free');
    });
  });

  describe('request budget', () => {
    const heldFor = (ms: number) =>
      findMany.mockImplementation(() =>
        Promise.resolve([
          endpoint({
            health: [health({ pacedUntil: new Date(Date.now() + ms) })],
          }),
        ]),
      );

    const settled = <T>(promise: Promise<T>) => {
      const state: { done: boolean; value?: unknown } = { done: false };
      promise.then(
        (value) => Object.assign(state, { done: true, value }),
        (error: unknown) => Object.assign(state, { done: true, value: error }),
      );
      return state;
    };

    const queuedPool = () =>
      poolWith({ acquireTimeoutMs: 120_000, pollMs: 5_000 });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('gives up eight seconds into a twenty second deadline', async () => {
      heldFor(LEASE_HOLD_MS);
      const outcome = settled(
        withinStoreDeadline(
          () => queuedPool().acquire(Store.GOOGLE_PLAY, 'us'),
          20_000,
        ),
      );

      await jest.advanceTimersByTimeAsync(7_999);
      expect(outcome.done).toBe(false);

      await jest.advanceTimersByTimeAsync(2);
      expect(outcome.value).toBeInstanceOf(StorePoolBusyError);
    });

    it('looks again every second while someone waits', async () => {
      heldFor(LEASE_HOLD_MS);
      settled(
        withinStoreDeadline(
          () => queuedPool().acquire(Store.GOOGLE_PLAY, 'us'),
          20_000,
        ),
      );

      await jest.advanceTimersByTimeAsync(5_000);

      expect(findMany).toHaveBeenCalledTimes(6);
    });

    it('keeps the queued poll interval', async () => {
      heldFor(LEASE_HOLD_MS);
      settled(queuedPool().acquire(Store.GOOGLE_PLAY, 'us'));

      await jest.advanceTimersByTimeAsync(10_000);

      expect(findMany).toHaveBeenCalledTimes(3);
    });

    it('shares one budget across every lease of a request', async () => {
      heldFor(LEASE_HOLD_MS);
      const outcome = settled(
        withinStoreDeadline(async () => {
          await new Promise((resolve) => setTimeout(resolve, 7_000));
          return queuedPool().acquire(Store.GOOGLE_PLAY, 'us');
        }, 20_000),
      );

      await jest.advanceTimersByTimeAsync(7_000);
      expect(outcome.done).toBe(false);

      await jest.advanceTimersByTimeAsync(1_001);
      expect(outcome.value).toBeInstanceOf(StorePoolBusyError);
    });

    it('clamps a far retry hint to ten seconds', async () => {
      heldFor(LEASE_HOLD_MS);
      const outcome = settled(
        withinStoreDeadline(
          () => queuedPool().acquire(Store.GOOGLE_PLAY, 'us'),
          20_000,
        ),
      );

      await jest.advanceTimersByTimeAsync(8_000);

      expect(outcome.value).toEqual(
        expect.objectContaining({ retryAfterSeconds: 10 }),
      );
    });

    it('clamps a near retry hint to two seconds', async () => {
      heldFor(500);
      const outcome = settled(
        withinStoreDeadline(
          () => queuedPool().acquire(Store.GOOGLE_PLAY, 'us'),
          20_000,
        ),
      );

      await jest.advanceTimersByTimeAsync(8_000);

      expect(outcome.value).toEqual(
        expect.objectContaining({ retryAfterSeconds: 2 }),
      );
    });
  });

  it('looks once even when the request budget is already spent', async () => {
    findMany.mockResolvedValue([endpoint()]);

    const lease = await withinStoreDeadline(
      () => poolWith().acquire(Store.APP_STORE),
      30,
    );

    expect(lease?.endpointId).toBe('e1');
  });
});

describe('ProxyAccountRefusedError', () => {
  it('starts its stack with the refusal instead of a wait it never made', () => {
    const error = new ProxyAccountRefusedError(Store.APP_STORE, 402, 300_000);

    expect(error.stack).toContain(
      'The proxy refused the APP_STORE tunnel (HTTP 402)',
    );
    expect(error.stack).not.toContain('within 0ms');
    expect(error).toMatchObject({
      name: 'ProxyAccountRefusedError',
      retryInMs: 300_000,
    });
  });
});
