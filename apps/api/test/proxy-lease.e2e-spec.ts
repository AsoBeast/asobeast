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
import { withinStoreDeadline } from '../src/store-providers/store-deadline';
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
  interactiveReserve: 1,
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

  const createEndpoint = (id: string, port: number) =>
    prisma.proxyEndpoint.create({
      data: {
        id,
        provider: 'test',
        externalId: id,
        host: '10.0.0.1',
        port,
        protocol: ProxyProtocol.HTTP,
        credentialRef: 'none',
        country: 'us',
        enabled: true,
      },
    });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProxyEndpoint" CASCADE');
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProxyEndpoint" CASCADE');
    await prisma.$disconnect();
  });

  const leaseAnEndpoint = async () => {
    const lease = await pool.acquire(Store.GOOGLE_PLAY, 'us');
    if (!lease) throw new Error('the pool handed out no endpoint');
    return lease;
  };

  describe('with one endpoint', () => {
    beforeEach(() => createEndpoint('only-us', 8080));

    it('never hands a second job the endpoint a running job still holds', async () => {
      const lease = await leaseAnEndpoint();
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
      const { endpointId, leasedAt } = await leaseAnEndpoint();
      await pool.release(endpointId, Store.GOOGLE_PLAY, {
        leasedAt,
        until: new Date(),
      });
      await elapse(MIN_INTERVAL_MS * 2);

      await expect(pool.acquire(Store.GOOGLE_PLAY, 'us')).resolves.toEqual(
        expect.objectContaining({ endpointId: 'only-us' }),
      );
    });

    it('keeps the hold of a newer lease when an older one hands back late', async () => {
      const newer = await leaseAnEndpoint();

      await pool.release(newer.endpointId, Store.GOOGLE_PLAY, {
        leasedAt: new Date(newer.leasedAt.getTime() - LEASE_HOLD_MS),
        until: new Date(),
      });

      await expect(pool.acquire(Store.GOOGLE_PLAY, 'us')).rejects.toThrow(
        ProxyPoolUnavailableError,
      );
    });

    it('lets queued work use a pool no larger than the reserve', async () => {
      await expect(pool.acquire(Store.GOOGLE_PLAY, 'us')).resolves.toEqual(
        expect.objectContaining({ endpointId: 'only-us' }),
      );
    });
  });

  describe('with two endpoints and a reserve of one', () => {
    beforeEach(async () => {
      await createEndpoint('us-1', 8080);
      await createEndpoint('us-2', 8081);
    });

    it('keeps the last free endpoint from a second queued lease', async () => {
      await leaseAnEndpoint();

      await expect(pool.acquire(Store.GOOGLE_PLAY, 'us')).rejects.toThrow(
        ProxyPoolUnavailableError,
      );
    });

    it('hands the kept endpoint to a request someone waits for', async () => {
      const queued = await leaseAnEndpoint();

      const waited = await withinStoreDeadline(() =>
        pool.acquire(Store.GOOGLE_PLAY, 'us'),
      );

      expect(waited?.endpointId).toBeDefined();
      expect(waited?.endpointId).not.toBe(queued.endpointId);
    });
  });
});
