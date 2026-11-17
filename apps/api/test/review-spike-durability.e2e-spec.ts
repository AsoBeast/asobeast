import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type { AlertPayload, ReviewSpikePayload } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AlertsDispatcher } from '../src/alerts/alerts.dispatcher';
import { AlertsModule } from '../src/alerts/alerts.module';
import { InstantAlertRelay } from '../src/alerts/instant-alert-relay';
import { InstantDeliveries } from '../src/alerts/instant-deliveries';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, JOBS, QUEUES } from '../src/jobs/jobs.types';
import { ReviewThemesService } from '../src/reviews/review-themes.service';
import { ReviewsService } from '../src/reviews/reviews.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ReviewResult } from '../src/store-providers/types';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

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

const yesterday = () => noonDaysAgo(1).toISOString().slice(0, 10);

describe('review spike durability (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let feeds: ReviewResult[][] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
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
    await clearFaults();
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
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

  const deliverPending = () => app.get(InstantAlertRelay).relayEveryWorkspace();

  const failFirstSpikeDelivery = () => {
    const deliveries = app.get(InstantDeliveries);
    const enqueue = deliveries.enqueue.bind(deliveries);
    let failed = false;
    jest
      .spyOn(deliveries, 'enqueue')
      .mockImplementation((payload: AlertPayload, options) => {
        if (!failed && payload.event === 'review.spike') {
          failed = true;
          return Promise.reject(new Error('redis went away'));
        }
        return enqueue(payload, options);
      });
  };

  const seedApp = async (historyDays: number): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'spike-durable',
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

  const sync = (appId: string, reviews: ReviewResult[], backfill = false) => {
    feeds.push(reviews);
    return asWorkspace(app, () =>
      app.get(ReviewsService).syncReviews({ appId, pages: 1, backfill }),
    );
  };

  const spikes = () =>
    prisma.alertEvent.findMany({ where: { event: 'review.spike' } });

  const faultOnce = async (
    name: string,
    table: string,
    condition: string,
  ): Promise<void> => {
    await prisma.$executeRawUnsafe(`CREATE SEQUENCE ${name}`);
    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON SEQUENCE ${name} TO asobeast_app`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF ${condition} AND nextval('${name}') = 1 THEN
          RAISE EXCEPTION '${name}';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER ${name} BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
  };

  const clearFault = async (name: string, table: string): Promise<void> => {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS ${name} ON "${table}"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${name}()`);
    await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS ${name}`);
  };

  const faultSpikeOnce = () =>
    faultOnce('e2e_spike_fault', 'AlertEvent', `NEW.event = 'review.spike'`);

  const faultReviewOnce = () =>
    faultOnce('e2e_review_fault', 'Review', `NEW."reviewId" = 'n8'`);

  const clearFaults = async () => {
    await clearFault('e2e_spike_fault', 'AlertEvent');
    await clearFault('e2e_review_fault', 'Review');
  };

  it('delivers an instant spike whose first delivery failed, without another review', async () => {
    instant();
    const hook = await subscribe();
    const appId = await seedApp(40);
    failFirstSpikeDelivery();

    await sync(appId, burst('n', 9));
    await deliverPending();
    await deliverPending();

    const jobs = await deliveriesTo(hook.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.payload).toMatchObject({
      event: 'review.spike',
      date: yesterday(),
      count: 11,
      app: { id: appId, store: 'APP_STORE', country: 'us' },
    });
    const recorded = await spikes();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].flushedAt).not.toBeNull();
    expect(await prisma.alertRelay.count()).toBe(0);
  });

  it('keeps a batched spike whose dispatch after the reviews never ran', async () => {
    const appId = await seedApp(40);
    const dispatcher = app.select(AlertsModule).get(AlertsDispatcher);
    const dispatch = dispatcher.dispatch.bind(dispatcher);
    jest
      .spyOn(dispatcher, 'dispatch')
      .mockImplementation((payload: AlertPayload) =>
        payload.event === 'review.spike'
          ? Promise.resolve()
          : dispatch(payload),
      );

    await sync(appId, burst('n', 9));

    const recorded = await spikes();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      flushedAt: null,
      flushId: null,
      dedupeKey: `review.spike:${appId}:${yesterday()}`,
    });
    const payload = recorded[0].payload as unknown as ReviewSpikePayload;
    expect(payload.count).toBe(11);
    expect(payload.topTheme).toMatchObject({ kind: 'complaint' });
  });

  it('never fails a sync whose spike write fails and still stores its reviews', async () => {
    const appId = await seedApp(40);
    const errors = jest.spyOn(Logger.prototype, 'error');
    await faultSpikeOnce();
    try {
      await expect(sync(appId, burst('n', 9))).resolves.toHaveLength(9);
    } finally {
      await clearFault('e2e_spike_fault', 'AlertEvent');
    }

    expect(await prisma.review.count({ where: { appId } })).toBe(89);
    expect(await spikes()).toEqual([]);
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining(`review spike of app ${appId}`),
    );
  });

  it('records one spike when two syncs carry the day over together', async () => {
    instant();
    const hook = await subscribe();
    const appId = await seedApp(40);

    await Promise.all([sync(appId, burst('a', 3)), sync(appId, burst('b', 3))]);

    const recorded = await spikes();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].payload).toMatchObject({ count: 8 });
    expect(await prisma.alertRelay.count()).toBe(1);
    await deliverPending();
    expect(await deliveriesTo(hook.id)).toHaveLength(1);
  });

  it('stores neither the reviews nor the spike when the insert fails', async () => {
    const appId = await seedApp(40);
    await faultReviewOnce();
    try {
      await expect(sync(appId, burst('n', 9))).rejects.toThrow();
    } finally {
      await clearFault('e2e_review_fault', 'Review');
    }

    expect(await prisma.review.count({ where: { appId } })).toBe(80);
    expect(await spikes()).toEqual([]);
  });

  it('records the spike without a theme when the theme cannot be read', async () => {
    const appId = await seedApp(40);
    jest
      .spyOn(app.get(ReviewThemesService), 'dayTheme')
      .mockRejectedValue(new Error('theme down'));

    await sync(appId, burst('n', 9));

    const recorded = await spikes();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].payload).toMatchObject({ topTheme: null, count: 11 });
  });
});
