import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type { ReviewSpikePayload } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ReviewsService } from '../src/reviews/reviews.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ReviewResult } from '../src/store-providers/types';
import { testDb } from './helpers/test-db';
import { asWorkspace } from './helpers/tenancy';
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

describe('review.spike alerts (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let feed: ReviewResult[] = [];

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
    feed = [];
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent" RESTART IDENTITY CASCADE',
    );
    jest.spyOn(app.get(StoreProviderRegistry), 'get').mockImplementation(
      (store: Store) =>
        ({
          store,
          reviews: (_id: string, _country: string, page: number) =>
            Promise.resolve(page === 1 ? feed : []),
        }) as unknown as ReturnType<StoreProviderRegistry['get']>,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedApp = async (
    historyDays: number,
    store: Store = Store.APP_STORE,
  ): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `spike-${store}`,
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
    feed = reviews;
    return asWorkspace(app, () =>
      app.get(ReviewsService).syncReviews({ appId, pages: 1, backfill }),
    );
  };

  const spikes = () =>
    prisma.alertEvent.findMany({ where: { event: 'review.spike' } });

  it('raises one spike for a day the sync carried over its threshold', async () => {
    const appId = await seedApp(40);

    await sync(appId, burst('n', 9));

    const [row, ...rest] = await spikes();
    expect(rest).toEqual([]);
    expect(row.dedupeKey).toBe(
      `review.spike:${appId}:${noonDaysAgo(1).toISOString().slice(0, 10)}`,
    );
    const payload = row.payload as unknown as ReviewSpikePayload;
    expect(payload).toMatchObject({
      count: 11,
      median: 2,
      threshold: 6,
      lowShare: 0.82,
      lowScoreMax: 2,
    });
    expect(payload.topTheme).toMatchObject({ kind: 'complaint' });
  });

  it('raises nothing again for the same reviews or one more that day', async () => {
    const appId = await seedApp(40);
    await sync(appId, burst('n', 9));
    await prisma.alertEvent.deleteMany();

    await sync(appId, burst('n', 9));
    await sync(appId, [...burst('n', 9), crashReview('late', 1)]);

    expect(await spikes()).toEqual([]);
  });

  it('raises nothing for a backfill, a short history or older reviews', async () => {
    const backfilled = await seedApp(40);
    await sync(backfilled, burst('b', 9), true);
    expect(await spikes()).toEqual([]);

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "App" CASCADE');
    const young = await seedApp(4);
    await sync(young, burst('y', 9));
    expect(await spikes()).toEqual([]);

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "App" CASCADE');
    const settled = await seedApp(40);
    await sync(settled, burst('o', 9, 3));
    expect(await spikes()).toEqual([]);
  });

  it('raises nothing when a Google Play edit moves a review into today', async () => {
    const appId = await seedApp(40, Store.GOOGLE_PLAY);
    const edited = {
      reviewId: 'seed-5-0',
      score: 1,
      text: 'crashes on launch after the update',
      updatedAt: new Date(),
    };

    await sync(appId, [edited]);

    expect(await spikes()).toEqual([]);
  });
});
