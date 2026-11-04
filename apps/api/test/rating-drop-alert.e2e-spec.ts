import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type {
  AlertBatchPayload,
  EmailAlertItem,
  RatingDroppedPayload,
  WebhookItem,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { formatBatchEmail } from '../src/alerts/email-format';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { ListingCaptureService } from '../src/apps/listing-capture.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  QUEUES,
} from '../src/jobs/jobs.types';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { ownerAgent, useCookies } from './helpers/session';
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
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new RatingRegistry();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send: jest.fn() })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    capture = app.get(ListingCaptureService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    registry.rating = { ratingAvg: 4.38, ratingCount: 830, version: '1.1.0' };
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AlertEvent", "Webhook", "EmailAlert" RESTART IDENTITY CASCADE',
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

  const subscribe = async (ratingDropTenths: number): Promise<WebhookItem> =>
    (
      await api
        .post('/webhooks')
        .send({
          url: `https://hooks.example.com/drops-${ratingDropTenths}`,
          events: ['rating.dropped'],
          ratingDropTenths,
        })
        .expect(201)
    ).body as WebhookItem;

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
    const strict = await subscribe(3);
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

  it('delivers a batched drop to the channels whose threshold it meets', async () => {
    const rated = await seedApp();
    const loose = await subscribe(2);
    const strict = await subscribe(3);
    const mail = (
      await api
        .post('/email-alerts')
        .send({
          email: 'ops@example.com',
          events: ['rating.dropped', 'review.spike'],
        })
        .expect(201)
    ).body as EmailAlertItem;
    await prisma.emailAlert.update({
      where: { id: mail.id },
      data: { confirmedAt: new Date() },
    });

    await refresh(rated.id);
    await api.post('/alerts/flush').expect(201);

    const jobs = await app
      .get<Queue<DeliverAlertPayload | DeliverEmailPayload>>(
        getQueueToken(QUEUES.ALERTS),
        { strict: false },
      )
      .getJobs(['wait', 'paused', 'delayed', 'waiting-children']);
    const batchFor = (id: string) =>
      jobs.find((job) =>
        'webhookId' in job.data
          ? job.data.webhookId === id
          : job.data.emailAlertId === id,
      )?.data.payload as AlertBatchPayload | undefined;
    expect(batchFor(loose.id)?.apps[0].ratingDrops).toEqual([
      expect.objectContaining({ dropTenths: 2 }),
    ]);
    expect(batchFor(strict.id)).toBeUndefined();
    const email = await formatBatchEmail(
      batchFor(mail.id) as AlertBatchPayload,
    );
    expect(email.text).toContain('Rating drops');
    expect(email.text).toContain('4.38');
  });
});
