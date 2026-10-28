import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, ProxyProtocol, Store } from '@prisma/client';
import { CrossTenantAccess } from '../src/common/tenancy/cross-tenant-access';
import { PrismaService } from '../src/prisma/prisma.service';
import { PoolShutdown } from '../src/store-providers/egress/pool-shutdown';
import { ProxyPoolConfig } from '../src/store-providers/egress/proxy-pool.config';
import {
  LEASE_HOLD_MS,
  ProxyPool,
  ProxyPoolUnavailableError,
} from '../src/store-providers/egress/proxy-pool.service';
import { testDb } from './helpers/test-db';

const MIN_INTERVAL_MS = 20;

const passThrough = {
  becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
    _justification: string,
    work: () => Promise<T>,
  ) => work(),
} as unknown as CrossTenantAccess;

const config = {
  enabled: true,
  minIntervalMs: MIN_INTERVAL_MS,
  acquireTimeoutMs: 200,
  pollMs: 10,
  credentialsFor: () => undefined,
} as unknown as ProxyPoolConfig;

const elapse = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('Proxy endpoint leases (e2e)', () => {
  let prisma: PrismaClient;
  let pool: ProxyPool;

  beforeAll(() => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    prisma = testDb();
    pool = new ProxyPool(
      prisma as unknown as PrismaService,
      passThrough,
      config,
      new PoolShutdown(),
    );
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProxyEndpoint" CASCADE');
    await prisma.proxyEndpoint.create({
      data: {
        id: 'only-us',
        provider: 'test',
        externalId: 'only-us',
        host: '10.0.0.1',
        port: 8080,
        protocol: ProxyProtocol.HTTP,
        credentialRef: 'none',
        country: 'us',
        enabled: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProxyEndpoint" CASCADE');
    await prisma.$disconnect();
  });

  const leaseTheOnlyEndpoint = async () => {
    const lease = await pool.acquire(Store.GOOGLE_PLAY, 'us');
    if (!lease) throw new Error('the pool handed out no endpoint');
    return lease;
  };

  it('never hands a second job the endpoint a running job still holds', async () => {
    const lease = await leaseTheOnlyEndpoint();
    await elapse(MIN_INTERVAL_MS * 3);

    const held = await prisma.proxyHealth.findUniqueOrThrow({
      where: {
        endpointId_store: { endpointId: 'only-us', store: Store.GOOGLE_PLAY },
      },
    });
    expect(held.pacedUntil).toEqual(
      new Date(lease.leasedAt.getTime() + LEASE_HOLD_MS),
    );

    await expect(pool.acquire(Store.GOOGLE_PLAY, 'us')).rejects.toThrow(
      ProxyPoolUnavailableError,
    );
  });

  it('leases the endpoint again once its job released it and the pacing ran out', async () => {
    const lease = await leaseTheOnlyEndpoint();
    await pool.release(lease.endpointId, Store.GOOGLE_PLAY, new Date());
    await elapse(MIN_INTERVAL_MS * 2);

    await expect(pool.acquire(Store.GOOGLE_PLAY, 'us')).resolves.toEqual(
      expect.objectContaining({ endpointId: 'only-us' }),
    );
  });
});
