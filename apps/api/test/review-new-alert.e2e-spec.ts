import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AlertBatchPayload } from '@asobeast/shared';
import { Job, Queue } from 'bullmq';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  QUEUES,
} from '../src/jobs/jobs.types';
import { ReviewsService } from '../src/reviews/reviews.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ReviewResult } from '../src/store-providers/types';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const REVIEWS: ReviewResult[] = [5, 3, 2].map((score) => ({
  reviewId: `r${score}`,
  userName: `Reviewer ${score}`,
  score,
  title: `${score} stars`,
  text: `A ${score} star review`,
  version: '3.1.0',
  updatedAt: new Date(`2026-10-2${score}T10:00:00.000Z`),
}));

interface Subscription {
  events: string[];
  reviewScores?: number[];
}

interface Received {
  newReviews: number[];
  negativeReviews: number[];
  events: string[];
  totals: number;
}

describe('review.new alerts (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let appId: string;

  const pendingJobs = (): Promise<
    Job<DeliverAlertPayload | DeliverEmailPayload>[]
  > =>
    app
      .get<Queue<DeliverAlertPayload | DeliverEmailPayload>>(
        getQueueToken(QUEUES.ALERTS),
        { strict: false },
      )
      .getJobs(['wait', 'paused', 'delayed', 'waiting-children']);

  const webhook = async (subscription: Subscription): Promise<string> =>
    (
      await prisma.webhook.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          url: 'https://hooks.example.com/reviews',
          ...subscription,
        },
      })
    ).id;

  const sync = (backfill = false) =>
    asWorkspace(app, () =>
      app.get(ReviewsService).syncReviews({ appId, pages: 1, backfill }),
    );

  const reviewEvents = (event: string) =>
    prisma.alertEvent.count({ where: { event } });

  const received = (payload: AlertBatchPayload): Received => ({
    newReviews: payload.apps.flatMap((section) =>
      (section.newReviews ?? []).map((alert) => alert.review.score),
    ),
    negativeReviews: payload.apps.flatMap((section) =>
      section.negativeReviews.map((alert) => alert.review.score),
    ),
    events: payload.events.map((alert) => alert.event),
    totals: payload.totals.events,
  });

  const flushedTo = async (): Promise<Map<string, Received>> => {
    await api.post('/alerts/flush').expect(201);
    const jobs = await pendingJobs();
    return new Map(
      jobs.map((job) => {
        const data = job.data;
        const channel =
          'webhookId' in data ? data.webhookId : data.emailAlertId;
        return [channel, received(data.payload as AlertBatchPayload)];
      }),
    );
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await obliterateQueues(app);
    await pauseQueues(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent", "Webhook", "EmailAlert" RESTART IDENTITY CASCADE',
    );
    appId = (
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '123',
          country: 'us',
          name: 'My App',
        },
      })
    ).id;
    jest.spyOn(app.get(StoreProviderRegistry), 'get').mockReturnValue({
      store: Store.APP_STORE,
      reviews: jest
        .fn()
        .mockImplementation((_id: string, _country: string, page: number) =>
          Promise.resolve(page === 1 ? REVIEWS : []),
        ),
    } as unknown as ReturnType<StoreProviderRegistry['get']>);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('delivers each channel the stars it picked and every review once', async () => {
    const everyStar = await webhook({ events: ['review.new'] });
    const lowStars = await webhook({
      events: ['review.new'],
      reviewScores: [1, 2],
    });
    const negativeOnly = await webhook({ events: ['review.negative'] });
    const both = await webhook({ events: ['review.new', 'review.negative'] });
    const praiseAndNegative = await webhook({
      events: ['review.new', 'review.negative'],
      reviewScores: [5],
    });
    const email = await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'ops@example.com',
        events: ['review.new'],
        reviewScores: [5],
        confirmedAt: new Date(),
      },
    });

    await sync();
    const delivered = await flushedTo();

    expect(delivered.get(everyStar)).toEqual({
      newReviews: [5, 3, 2],
      negativeReviews: [],
      events: ['review.new', 'review.new', 'review.new'],
      totals: 3,
    });
    expect(delivered.get(lowStars)).toMatchObject({
      newReviews: [2],
      totals: 1,
    });
    expect(delivered.get(negativeOnly)).toEqual({
      newReviews: [],
      negativeReviews: [2],
      events: ['review.negative'],
      totals: 1,
    });
    expect(delivered.get(both)).toEqual({
      newReviews: [5, 3, 2],
      negativeReviews: [],
      events: ['review.new', 'review.new', 'review.new'],
      totals: 3,
    });
    expect(delivered.get(praiseAndNegative)).toEqual({
      newReviews: [5],
      negativeReviews: [2],
      events: ['review.negative', 'review.new'],
      totals: 2,
    });
    expect(delivered.get(email.id)).toMatchObject({
      newReviews: [5],
      negativeReviews: [],
    });
  });

  it('carries the author of a new review in the report payload', async () => {
    const channel = await webhook({
      events: ['review.new'],
      reviewScores: [5],
    });

    await sync();
    await api.post('/alerts/flush').expect(201);
    const [job] = (await pendingJobs()).filter(
      (pending) => (pending.data as DeliverAlertPayload).webhookId === channel,
    );
    const payload = job.data.payload as AlertBatchPayload;

    expect(payload.apps[0].newReviews?.[0].review).toMatchObject({
      score: 5,
      author: 'Reviewer 5',
      title: '5 stars',
      version: '3.1.0',
    });
  });

  it('collects nothing for a second sync of the same reviews', async () => {
    await webhook({ events: ['review.new'] });

    await sync();
    expect(await reviewEvents('review.new')).toBe(3);
    await sync();

    expect(await reviewEvents('review.new')).toBe(3);
  });

  it('collects nothing for the backfill of an import', async () => {
    await webhook({ events: ['review.new'] });

    await sync(true);

    expect(await prisma.alertEvent.count()).toBe(0);
  });

  it('collects no new review without a subscriber', async () => {
    await webhook({ events: ['review.negative'] });

    await sync();

    expect(await reviewEvents('review.new')).toBe(0);
    expect(await reviewEvents('review.negative')).toBe(1);
  });
});
