import { ProxyEndpoint, ProxyProtocol, ProxyTier } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { POOL_CREDENTIAL_REF, ProxyPoolConfig } from './proxy-pool.config';
import { ProxyPoolSync } from './proxy-pool.sync';
import { ProxyProviderClient, UpstreamProxy } from './proxy-provider';

const objectWith = (fields: Record<string, unknown>): Record<string, unknown> =>
  expect.objectContaining(fields) as Record<string, unknown>;

const upstreamProxy = (
  externalId: string,
  host: string,
  port = 8080,
): UpstreamProxy => ({
  externalId,
  host,
  port,
  protocol: ProxyProtocol.HTTP,
  tier: ProxyTier.DATACENTER,
  country: 'us',
});

const endpointRow = (over: Partial<ProxyEndpoint>): ProxyEndpoint => ({
  id: 'e1',
  provider: 'webshare',
  externalId: 'p1',
  host: '10.0.0.1',
  port: 8080,
  protocol: ProxyProtocol.HTTP,
  tier: ProxyTier.DATACENTER,
  credentialRef: POOL_CREDENTIAL_REF,
  country: 'us',
  enabled: true,
  retiredAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
  ...over,
});

describe('ProxyPoolSync', () => {
  const findMany = jest.fn<Promise<ProxyEndpoint[]>, []>();
  const create = jest.fn();
  const update = jest.fn();
  const updateMany = jest.fn();
  const list = jest.fn<Promise<UpstreamProxy[]>, []>();

  const prisma = {
    proxyEndpoint: { findMany, create, update, updateMany },
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const config = { syncCron: '0 2 * * *' } as unknown as ProxyPoolConfig;
  const client: ProxyProviderClient = { provider: 'webshare', list };

  const syncWith = (upstream: ProxyProviderClient | null) =>
    new ProxyPoolSync(prisma, crossTenant, config, upstream);

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    create.mockReset().mockResolvedValue(undefined);
    update.mockReset().mockResolvedValue(undefined);
    updateMany.mockReset().mockResolvedValue({ count: 0 });
    list.mockReset().mockResolvedValue([]);
  });

  it('does nothing without a configured provider', async () => {
    const sync = syncWith(null);

    await expect(sync.reconcile()).resolves.toBeNull();

    expect(sync.enabled).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('adds a new endpoint disabled so a probe decides when it serves traffic', async () => {
    list.mockResolvedValue([upstreamProxy('p1', '10.0.0.1')]);

    const result = await syncWith(client).reconcile();

    expect(result).toEqual({ added: 1, restored: 0, retired: 0, total: 1 });
    expect(create).toHaveBeenCalledWith({
      data: objectWith({
        provider: 'webshare',
        externalId: 'p1',
        host: '10.0.0.1',
        port: 8080,
        country: 'us',
        credentialRef: POOL_CREDENTIAL_REF,
        enabled: false,
      }),
    });
  });

  it('disables an endpoint that disappeared upstream instead of deleting it', async () => {
    findMany.mockResolvedValue([
      endpointRow({ id: 'gone', externalId: 'p9', host: '10.0.0.9' }),
    ]);
    list.mockResolvedValue([upstreamProxy('p1', '10.0.0.1')]);

    const result = await syncWith(client).reconcile();

    expect(result?.retired).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['gone'] } },
      data: { enabled: false, retiredAt: expect.any(Date) as Date },
    });
  });

  it('keeps the health history when a retired address is reissued', async () => {
    findMany.mockResolvedValue([
      endpointRow({
        id: 'old',
        externalId: 'p1',
        host: '10.0.0.1',
        enabled: false,
        retiredAt: new Date('2026-07-01T00:00:00Z'),
      }),
    ]);
    list.mockResolvedValue([upstreamProxy('p2', '10.0.0.1')]);

    const result = await syncWith(client).reconcile();

    expect(result).toEqual({ added: 0, restored: 1, retired: 0, total: 1 });
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'old' },
      data: objectWith({ externalId: 'p2', retiredAt: null }),
    });
  });

  it('follows an endpoint that moved to a new address', async () => {
    findMany.mockResolvedValue([
      endpointRow({ id: 'moved', externalId: 'p1', host: '10.0.0.1' }),
    ]);
    list.mockResolvedValue([upstreamProxy('p1', '10.0.0.7')]);

    const result = await syncWith(client).reconcile();

    expect(result).toEqual({ added: 0, restored: 0, retired: 0, total: 1 });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'moved' },
      data: objectWith({ host: '10.0.0.7' }),
    });
  });

  it('keeps the pool intact when the provider lists nothing', async () => {
    findMany.mockResolvedValue([endpointRow({})]);
    list.mockResolvedValue([]);

    await expect(syncWith(client).reconcile()).resolves.toBeNull();

    expect(updateMany).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
