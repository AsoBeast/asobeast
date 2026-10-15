import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { PoolCapacity } from '../store-providers/egress/pool-capacity.service';
import { ProxyPoolConfig } from '../store-providers/egress/proxy-pool.config';
import { DailyCapacity } from './daily-capacity.service';

const MINUTES_PER_DAY = 60 * 24;

describe('DailyCapacity', () => {
  const count = jest.fn<Promise<number>, [unknown]>();

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const build = (over: Partial<ProxyPoolConfig> = {}) => {
    const pool = {
      enabled: true,
      endpointRpm: 15,
      maxWorkerConcurrency: 8,
      ...over,
    } as ProxyPoolConfig;
    return new DailyCapacity(
      {
        get: (key: keyof Env) => (key === 'SCRAPE_GPLAY_RPM' ? 10 : 15),
      } as unknown as ConfigService<Env, true>,
      pool,
      new PoolCapacity(
        { proxyEndpoint: { count } } as unknown as PrismaService,
        crossTenant,
        pool,
      ),
    );
  };

  beforeEach(() => {
    count.mockReset();
  });

  it('answers the host budget of each store while the pool is off', async () => {
    const capacity = build({ enabled: false });

    await expect(capacity.perDay(Store.APP_STORE)).resolves.toBe(
      15 * MINUTES_PER_DAY,
    );
    await expect(capacity.perDay(Store.GOOGLE_PLAY)).resolves.toBe(
      10 * MINUTES_PER_DAY,
    );
    expect(count).not.toHaveBeenCalled();
  });

  it('answers every healthy endpoint at its rate while the workers can run them all', async () => {
    count.mockResolvedValue(5);

    await expect(build().perDay(Store.APP_STORE)).resolves.toBe(
      5 * 15 * MINUTES_PER_DAY,
    );
  });

  it('caps the healthy endpoints at the worker concurrency ceiling', async () => {
    count.mockResolvedValue(20);

    await expect(build().perDay(Store.APP_STORE)).resolves.toBe(
      8 * 15 * MINUTES_PER_DAY,
    );
  });

  it('answers no capacity when no endpoint is healthy', async () => {
    count.mockResolvedValue(0);

    await expect(build().perDay(Store.GOOGLE_PLAY)).resolves.toBe(0);
  });
});
