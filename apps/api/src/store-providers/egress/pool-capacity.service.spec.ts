import { Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { PoolCapacity } from './pool-capacity.service';
import { ProxyPoolConfig } from './proxy-pool.config';

describe('PoolCapacity', () => {
  const count = jest.fn<Promise<number>, [unknown]>();

  const prisma = {
    proxyEndpoint: { count },
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const capacityWith = (over: Record<string, unknown> = {}) =>
    new PoolCapacity(prisma, crossTenant, {
      enabled: true,
      maxWorkerConcurrency: 8,
      ...over,
    } as unknown as ProxyPoolConfig);

  beforeEach(() => {
    count.mockReset().mockResolvedValue(4);
  });

  it('leaves the self hosted worker alone when no pool is configured', async () => {
    await expect(
      capacityWith({ enabled: false }).concurrencyFor(Store.APP_STORE),
    ).resolves.toBeNull();

    expect(count).not.toHaveBeenCalled();
  });

  it('matches concurrency to the healthy endpoint count', async () => {
    await expect(capacityWith().concurrencyFor(Store.APP_STORE)).resolves.toBe(
      4,
    );
  });

  it('stays inside the configured ceiling on a large pool', async () => {
    count.mockResolvedValue(100);

    await expect(
      capacityWith().concurrencyFor(Store.GOOGLE_PLAY),
    ).resolves.toBe(8);
  });

  it('keeps one worker alive when the whole pool is cooling down', async () => {
    count.mockResolvedValue(0);

    await expect(capacityWith().concurrencyFor(Store.APP_STORE)).resolves.toBe(
      1,
    );
  });

  it('excludes endpoints cooling down for that store only', async () => {
    const now = new Date('2026-08-08T10:00:00Z');

    await capacityWith().healthy(Store.GOOGLE_PLAY, now);

    expect(count).toHaveBeenCalledWith({
      where: {
        enabled: true,
        retiredAt: null,
        health: {
          none: { store: Store.GOOGLE_PLAY, cooldownUntil: { gt: now } },
        },
      },
    });
  });

  it('caches the count so every job does not re-query the pool', async () => {
    const capacity = capacityWith();
    const now = new Date('2026-08-08T10:00:00Z');

    await capacity.healthy(Store.APP_STORE, now);
    await capacity.healthy(Store.APP_STORE, new Date(now.getTime() + 1_000));

    expect(count).toHaveBeenCalledTimes(1);
  });

  it('re-reads the pool once the cache goes stale', async () => {
    const capacity = capacityWith();
    const now = new Date('2026-08-08T10:00:00Z');

    await capacity.healthy(Store.APP_STORE, now);
    await capacity.healthy(Store.APP_STORE, new Date(now.getTime() + 60_000));

    expect(count).toHaveBeenCalledTimes(2);
  });
});
