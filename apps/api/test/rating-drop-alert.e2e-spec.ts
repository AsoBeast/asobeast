import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type { RatingDroppedPayload } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ListingCaptureService } from '../src/apps/listing-capture.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, QUEUES } from '../src/jobs/jobs.types';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const DAY_MS = 86_400_000;

class RatingRegistry {
  rating = { ratingAvg: 4.38, ratingCount: 830, version: '1.1.0' };

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string): Promise<NormalizedApp> =>
        Promise.resolve({
          store,
          storeAppId,
          title: 'Rated',
          description: 'Rated app',
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

describe('rating drop alert (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let capture: ListingCaptureService;
  const registry = new RatingRegistry();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    capture = app.get(ListingCaptureService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    registry.rating = { ratingAvg: 4.38, ratingCount: 830, version: '1.1.0' };
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AlertEvent", "Webhook" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedApp = async ({
    name = 'Rated',
    isCompetitor = false,
    ratingCount = 800,
    oldestDays = 8,
    newestDays = 1,
  } = {}) => {
    const now = Date.now();
    return prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `${name}-store`,
        country: 'us',
        name,
        isCompetitor,
        snapshots: {
          create: Array.from(
            { length: oldestDays - newestDays + 1 },
            (_, index) => ({
              title: name,
              description: 'desc',
              raw: {},
              ratingAvg: 4.6,
              ratingCount,
              version: '1.0.0',
              capturedAt: new Date(now - (newestDays + index) * DAY_MS),
            }),
          ),
        },
      },
    });
  };

  const refresh = (appId: string) =>
    asWorkspace(app, () => capture.refreshListing(appId));

  const drops = () =>
    prisma.alertEvent.findMany({ where: { event: 'rating.dropped' } });

  const today = () => new Date().toISOString().slice(0, 10);

  it('collects one drop, keeps it on a rerun and deepens it', async () => {
    const rated = await seedApp();

    await refresh(rated.id);
    const [first] = await drops();
    expect(first.dedupeKey).toBe(`rating.dropped:${rated.id}:${today()}`);
    expect(first.payload).toMatchObject({
      from: 4.6,
      to: 4.38,
      dropTenths: 2,
      version: '1.1.0',
      country: 'us',
    });

    await refresh(rated.id);
    expect(await drops()).toHaveLength(1);

    registry.rating = { ratingAvg: 4.3, ratingCount: 840, version: '1.1.0' };
    await refresh(rated.id);
    const deepened = await drops();
    expect(deepened).toHaveLength(1);
    expect(deepened[0].payload).toMatchObject({ dropTenths: 3, to: 4.3 });
  });

  it('raises nothing with too few ratings, an old reference or a competitor', async () => {
    const few = await seedApp({ name: 'Few', ratingCount: 12 });
    const stale = await seedApp({
      name: 'Stale',
      oldestDays: 13,
      newestDays: 11,
    });
    const rival = await seedApp({ name: 'Rival', isCompetitor: true });

    await refresh(few.id);
    await refresh(stale.id);
    await refresh(rival.id);

    expect(await drops()).toEqual([]);
  });

  it('delivers an instant drop only to a channel whose threshold it meets', async () => {
    const config = app.get(ConfigService);
    const read: (key: string) => unknown = config.get.bind(config);
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string): unknown =>
        key === 'ALERT_DELIVERY' ? 'instant' : read(key),
      );
    const rated = await seedApp();
    const strict = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/strict',
        events: ['rating.dropped'],
        ratingDropTenths: 3,
      },
    });
    const queue = app.get<Queue<DeliverAlertPayload>>(
      getQueueToken(QUEUES.ALERTS),
      { strict: false },
    );
    const queued = async () =>
      (await queue.getJobs(['wait', 'paused'])).filter(
        (job) => job.data.webhookId === strict.id,
      );

    await refresh(rated.id);
    expect(await queued()).toHaveLength(0);

    registry.rating = { ratingAvg: 4.3, ratingCount: 840, version: '1.1.0' };
    await refresh(rated.id);
    const jobs = await queued();
    expect(jobs).toHaveLength(1);
    expect((jobs[0].data.payload as RatingDroppedPayload).dropTenths).toBe(3);
  });
});
