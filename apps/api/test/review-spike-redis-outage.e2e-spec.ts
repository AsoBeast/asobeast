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
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, JOBS, QUEUES } from '../src/jobs/jobs.types';
import { ReviewsService } from '../src/reviews/reviews.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ReviewResult } from '../src/store-providers/types';
import { startRedisOutage, type RedisOutage } from './helpers/redis-outage';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const SYNC_DEADLINE_MS = 3_000;
const RECOVERY_DEADLINE_MS = 15_000;
const RECOVERY_POLL_MS = 250;
const DAY_MS = 86_400_000;

const noonDaysAgo = (days: number): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12) -
      days * DAY_MS,
  );
};

const crashReview = (id: string, daysAgo: number): ReviewResult => ({
  reviewId: id,
  userName: 'Reviewer',
  score: 1,
  title: 'Crashes',
  text: 'crashes on launch after the update',
  version: '2.0.0',
  updatedAt: noonDaysAgo(daysAgo),
});

const burst = (prefix: string, count: number, daysAgo = 1): ReviewResult[] =>
  Array.from({ length: count }, (_, index) =>
    crashReview(`${prefix}${index}`, daysAgo),
  );

const withinDeadline = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('the sync waited on redis')),
        SYNC_DEADLINE_MS,
      ).unref(),
    ),
  ]);

describe('review spike during a redis outage (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let outage: RedisOutage;
  let feeds: ReviewResult[][] = [];
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
    }).compile();
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
    feeds = [];
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent", "Webhook" RESTART IDENTITY CASCADE',
    );
    await alertsQueue().obliterate({ force: true });
    await alertsQueue().pause();
    jest.spyOn(app.get(StoreProviderRegistry), 'get').mockImplementation(
      (store: Store) =>
        ({
          store,
          reviews: (_id: string, _country: string, page: number) =>
            Promise.resolve(page === 1 ? (feeds.shift() ?? []) : []),
        }) as unknown as ReturnType<StoreProviderRegistry['get']>,
    );
  });

  afterAll(async () => {
    await outage.restore().catch(() => undefined);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent", "Webhook" RESTART IDENTITY CASCADE',
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

  const subscribe = (events: string[] = ['review.spike']) =>
    prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/spikes',
        events,
      },
    });

  const deliveriesTo = async (webhookId: string) =>
    (await alertsQueue().getJobs(['wait', 'paused', 'delayed'])).filter(
      (job) =>
        job.name === JOBS.DELIVER_ALERT && job.data.webhookId === webhookId,
    );

  const seedApp = async (historyDays: number): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'spike-outage',
        country: 'us',
        name: 'Spiky',
      },
    });
    await prisma.review.createMany({
      data: Array.from({ length: historyDays }, (_, back) =>
        [0, 1].map((slot) => ({
          appId: created.id,
          reviewId: `seed-${back + 1}-${slot}`,
          score: 5,
          text: 'calm and lovely reminders every morning',
          reviewedAt: noonDaysAgo(back + 1),
        })),
      ).flat(),
    });
    return created.id;
  };

  const sync = (appId: string, reviews: ReviewResult[]) => {
    feeds.push(reviews);
    return asWorkspace(app, () =>
      app.get(ReviewsService).syncReviews({ appId, pages: 1, backfill: false }),
    );
  };

  const spikes = () =>
    prisma.alertEvent.findMany({ where: { event: 'review.spike' } });

  const relayOnceRedisReturns = async (): Promise<number> => {
    const deadline = Date.now() + RECOVERY_DEADLINE_MS;
    while (Date.now() < deadline) {
      const relayed = await app.get(InstantAlertRelay).relayEveryWorkspace();
      if (relayed > 0) return relayed;
      await new Promise((resolve) => setTimeout(resolve, RECOVERY_POLL_MS));
    }
    throw new Error('the relay never delivered after redis returned');
  };

  const recordedWithin = async (deadlineMs: number): Promise<number> => {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
      const pending = await prisma.alertRelay.count();
      if (pending > 0) return pending;
      await new Promise((resolve) => setTimeout(resolve, RECOVERY_POLL_MS));
    }
    return 0;
  };

  it('records a spike without waiting on redis and delivers it once redis returns', async () => {
    instant();
    const hook = await subscribe();
    const appId = await seedApp(40);

    try {
      await outage.sever();
      const startedAt = Date.now();
      await expect(
        withinDeadline(sync(appId, burst('n', 9))),
      ).resolves.toHaveLength(9);
      expect(Date.now() - startedAt).toBeLessThan(SYNC_DEADLINE_MS);

      const [row, ...rest] = await spikes();
      expect(rest).toEqual([]);
      expect(row.flushedAt).not.toBeNull();
      expect(await prisma.alertRelay.count()).toBe(1);

      await outage.restore();
      await expect(relayOnceRedisReturns()).resolves.toBe(1);

      const jobs = await deliveriesTo(hook.id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.payload).toMatchObject({
        event: 'review.spike',
        count: 11,
      });
      expect(jobs[0].opts.jobId).toBe(`instant~${row.id}~webhook~${hook.id}`);
      expect(await prisma.alertRelay.count()).toBe(0);
    } finally {
      await outage.restore().catch(() => undefined);
    }
  });

  it('records the spike before a review alert that waits on redis', async () => {
    instant();
    const hook = await subscribe(['review.spike', 'review.negative']);
    const appId = await seedApp(40);

    try {
      await outage.sever();
      const syncing = sync(appId, burst('n', 9));

      expect(await recordedWithin(SYNC_DEADLINE_MS)).toBe(1);

      await outage.restore();
      await expect(syncing).resolves.toHaveLength(9);
      await relayOnceRedisReturns();

      const jobs = await deliveriesTo(hook.id);
      const events = jobs.map((job) => job.data.payload.event);
      expect(events.filter((event) => event === 'review.spike')).toHaveLength(
        1,
      );
      expect(
        events.filter((event) => event === 'review.negative'),
      ).toHaveLength(9);
    } finally {
      await outage.restore().catch(() => undefined);
    }
  });
});
