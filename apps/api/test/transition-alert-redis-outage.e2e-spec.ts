import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AlertsModule } from '../src/alerts/alerts.module';
import { InstantAlertRelay } from '../src/alerts/instant-alert-relay';
import { InstantDeliveries } from '../src/alerts/instant-deliveries';
import { ListingCaptureService } from '../src/apps/listing-capture.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreAppNotFoundError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { startRedisOutage, type RedisOutage } from './helpers/redis-outage';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const CAPTURE_DEADLINE_MS = 3_000;
const RECOVERY_DEADLINE_MS = 15_000;
const RECOVERY_POLL_MS = 250;
const DAY_MS = 86_400_000;
const UNCHANGED_RATING = {
  ratingAvg: 4.38,
  ratingCount: 830,
  version: '1.1.0',
};
const DROPPED_RATING = { ratingAvg: 4.3, ratingCount: 840, version: '1.1.0' };

class OutageRegistry {
  missing = false;
  rating = UNCHANGED_RATING;

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string): Promise<NormalizedApp> =>
        this.missing
          ? Promise.reject(new StoreAppNotFoundError(store, storeAppId))
          : Promise.resolve({
              store,
              storeAppId,
              title: 'Listed',
              description: 'Listed app',
              raw: {},
              searchable: true,
              ...this.rating,
            }),
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
      topCharts: () => Promise.resolve([]),
      reviews: () => Promise.resolve([]),
      availability: () => Promise.resolve([]),
      developerApps: () => Promise.resolve([]),
    };
  }
}

const withinDeadline = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('the capture waited on redis')),
        CAPTURE_DEADLINE_MS,
      ).unref(),
    ),
  ]);

describe('transition alerts during a redis outage (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let outage: RedisOutage;
  const registry = new OutageRegistry();
  const upstreamPort = Number(process.env.REDIS_PORT);

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    outage = await startRedisOutage(upstreamPort);
    process.env.REDIS_PORT = String(outage.port);
    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .compile();
    app = moduleFixture.createNestApplication<App>();
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    registry.missing = false;
    registry.rating = UNCHANGED_RATING;
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AlertEvent", "Webhook" RESTART IDENTITY CASCADE',
    );
    await alertsQueue().obliterate({ force: true });
    await alertsQueue().pause();
  });

  afterAll(async () => {
    await outage.restore().catch(() => undefined);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AlertEvent", "Webhook" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    await outage.stop();
    process.env.REDIS_PORT = String(upstreamPort);
    await prisma.$disconnect();
  });

  const alertsQueue = () =>
    app
      .select(AlertsModule)
      .get<Queue<DeliverAlertPayload>>(getQueueToken(QUEUES.ALERTS));

  const instant = () => {
    const config = app.get(ConfigService);
    const read: (key: string) => unknown = config.get.bind(config);
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string): unknown =>
        key === 'ALERT_DELIVERY' ? 'instant' : read(key),
      );
  };

  const subscribe = () =>
    prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/transitions',
        events: ['app.delisted', 'app.unlisted_market', 'rating.dropped'],
      },
    });

  const deliveriesTo = async (webhookId: string) =>
    (await alertsQueue().getJobs(['wait', 'paused', 'delayed'])).filter(
      (job) =>
        job.name === JOBS.DELIVER_ALERT && job.data.webhookId === webhookId,
    );

  const relayOnceRedisReturns = async (): Promise<number> => {
    const deadline = Date.now() + RECOVERY_DEADLINE_MS;
    while (Date.now() < deadline) {
      const relayed = await app.get(InstantAlertRelay).relayEveryWorkspace();
      if (relayed > 0) return relayed;
      await new Promise((resolve) => setTimeout(resolve, RECOVERY_POLL_MS));
    }
    throw new Error('the relay never delivered after redis returned');
  };

  const seedApp = (name: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `${name}-store`,
        country: 'us',
        name,
      },
    });

  const seedRated = () => {
    const now = Date.now();
    return prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'Rated-store',
        country: 'us',
        name: 'Rated',
        snapshots: {
          create: Array.from({ length: 8 }, (_, index) => ({
            title: 'Rated',
            description: 'desc',
            raw: {},
            ratingAvg: 4.6,
            ratingCount: 800,
            version: '1.0.0',
            capturedAt: new Date(now - (index + 1) * DAY_MS),
          })),
        },
      },
    });
  };

  const refresh = (appId: string) =>
    asWorkspace(app, () =>
      app.get(ListingCaptureService).refreshListing(appId),
    );

  const scoreAutoTrackedKeywords = async () => {
    const date = new Date(new Date().toISOString().slice(0, 10));
    const keywords = await prisma.keyword.findMany({ select: { id: true } });
    await prisma.keywordMetric.createMany({
      data: keywords.map(({ id }) => ({
        keywordId: id,
        date,
        traffic: 6,
        difficulty: 5,
      })),
      skipDuplicates: true,
    });
  };

  const settledRows = (event: string) =>
    prisma.alertEvent.findMany({
      where: { event, flushedAt: { not: null } },
    });

  it('records a home delisting without waiting on redis and delivers it once redis returns', async () => {
    instant();
    const hook = await subscribe();
    const own = await seedApp('Own');
    await refresh(own.id);
    await scoreAutoTrackedKeywords();

    try {
      await outage.sever();
      registry.missing = true;
      const startedAt = Date.now();
      await expect(withinDeadline(refresh(own.id))).resolves.toBeNull();
      expect(Date.now() - startedAt).toBeLessThan(CAPTURE_DEADLINE_MS);

      const stored = await prisma.app.findUniqueOrThrow({
        where: { id: own.id },
      });
      expect(stored.delistedAt).not.toBeNull();
      expect(await prisma.alertRelay.count()).toBe(1);
      const [event] = await settledRows('app.delisted');
      expect(event).toBeDefined();

      await outage.restore();
      await expect(relayOnceRedisReturns()).resolves.toBe(1);

      const jobs = await deliveriesTo(hook.id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.payload.event).toBe('app.delisted');
      expect(jobs[0].id).toBe(`instant~${event.id}~webhook~${hook.id}`);
      expect(await prisma.alertRelay.count()).toBe(0);
    } finally {
      await outage.restore().catch(() => undefined);
    }
  });

  it('records a rating drop without waiting on redis and delivers it once redis returns', async () => {
    instant();
    const hook = await subscribe();
    const rated = await seedRated();
    await refresh(rated.id);
    await scoreAutoTrackedKeywords();
    await app.get(InstantAlertRelay).relayEveryWorkspace();
    await alertsQueue().obliterate({ force: true });
    await alertsQueue().pause();

    try {
      await outage.sever();
      registry.rating = DROPPED_RATING;
      const startedAt = Date.now();
      await expect(withinDeadline(refresh(rated.id))).resolves.toMatchObject({
        snapshotId: expect.any(String) as string,
      });
      expect(Date.now() - startedAt).toBeLessThan(CAPTURE_DEADLINE_MS);
      expect(await prisma.alertRelay.count()).toBe(1);

      await outage.restore();
      await expect(relayOnceRedisReturns()).resolves.toBe(1);

      const jobs = await deliveriesTo(hook.id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.payload).toMatchObject({
        event: 'rating.dropped',
        dropTenths: 3,
      });
    } finally {
      await outage.restore().catch(() => undefined);
    }
  });

  it('keeps an undelivered alert through a restart of the relay', async () => {
    instant();
    const hook = await subscribe();
    const own = await seedApp('Own');
    await refresh(own.id);
    await scoreAutoTrackedKeywords();

    try {
      await outage.sever();
      registry.missing = true;
      await withinDeadline(refresh(own.id));
      await outage.restore();

      jest
        .spyOn(app.get(InstantDeliveries), 'enqueue')
        .mockRejectedValueOnce(new Error('the relay process stopped'));
      await expect(
        app.get(InstantAlertRelay).relayEveryWorkspace(),
      ).resolves.toBe(0);
      await expect(relayOnceRedisReturns()).resolves.toBe(1);

      expect(await deliveriesTo(hook.id)).toHaveLength(1);
      expect(await prisma.alertRelay.count()).toBe(0);
    } finally {
      await outage.restore().catch(() => undefined);
    }
  });
});
