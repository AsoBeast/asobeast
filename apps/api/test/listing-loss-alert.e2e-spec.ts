import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type {
  AlertBatchPayload,
  AppUnlistedMarketPayload,
  WebhookItem,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ListingCaptureService } from '../src/apps/listing-capture.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, QUEUES } from '../src/jobs/jobs.types';
import { StoreAppNotFoundError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

class LossRegistry {
  missing = false;

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

describe('listing loss alerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let capture: ListingCaptureService;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new LossRegistry();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
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
    registry.missing = false;
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

  const seedApp = (name: string, primaryAppId: string | null = null) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `${name}-store`,
        country: 'us',
        name,
        isCompetitor: primaryAppId !== null,
        primaryAppId,
      },
    });

  const track = async (
    appId: string,
    country: string,
    texts: string[],
    paused: string[] = [],
  ) => {
    for (const text of [...texts, ...paused]) {
      const keyword = await prisma.keyword.create({
        data: { text, store: Store.APP_STORE, country },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: !paused.includes(text),
        },
      });
    }
  };

  const refresh = (appId: string, country?: string) =>
    asWorkspace(app, () => capture.refreshListing(appId, country));

  const lost = async (appId: string, country?: string) => {
    registry.missing = true;
    await refresh(appId, country);
    registry.missing = false;
  };

  const rows = (event: string) =>
    prisma.alertEvent.findMany({ where: { event } });

  it('alerts a home delisting once and again only after the app came back', async () => {
    const own = await seedApp('Own');

    await lost(own.id);
    await lost(own.id);
    const [row, ...rest] = await rows('app.delisted');
    expect(rest).toEqual([]);
    expect(row.payload).toMatchObject({ country: 'us', store: 'APP_STORE' });
    const stored = await prisma.app.findUniqueOrThrow({
      where: { id: own.id },
    });
    expect(stored.delistedAt).not.toBeNull();
    expect(row.dedupeKey).toBe(
      `delisted:${own.id}:${stored.delistedAt?.toISOString()}`,
    );

    await refresh(own.id);
    await lost(own.id);
    expect(await rows('app.delisted')).toHaveLength(2);
  });

  it('alerts a competitor delisting with the competitor mark', async () => {
    const own = await seedApp('Own');
    const rival = await seedApp('Rival', own.id);

    await lost(rival.id);

    const [row] = await rows('app.delisted');
    expect(row.appId).toBe(rival.id);
    expect(row.payload).toMatchObject({ app: { isCompetitor: true } });
  });

  it('alerts a lost market the app was listed in with its active keywords', async () => {
    const own = await seedApp('Own');
    await track(own.id, 'de', ['gewohnheit', 'routine'], ['tagebuch']);
    await refresh(own.id, 'de');

    await lost(own.id, 'de');

    const [row, ...rest] = await rows('app.unlisted_market');
    expect(rest).toEqual([]);
    const payload = row.payload as unknown as AppUnlistedMarketPayload;
    expect(row.dedupeKey).toBe(`unlisted:${own.id}:de:${payload.occurredAt}`);
    expect(payload).toMatchObject({
      market: 'de',
      trackedKeywords: 2,
    });
    const stored = await prisma.app.findUniqueOrThrow({
      where: { id: own.id },
    });
    expect(stored.unlistedMarkets).toContain('de');
  });

  it('alerts nothing for a market the app was never listed in', async () => {
    const own = await seedApp('Own');
    await track(own.id, 'fr', ['habitude']);

    await lost(own.id, 'fr');

    const stored = await prisma.app.findUniqueOrThrow({
      where: { id: own.id },
    });
    expect(stored.unlistedMarkets).toContain('fr');
    expect(await rows('app.unlisted_market')).toEqual([]);
  });

  it('counts the keywords of the primary for a competitor market', async () => {
    const own = await seedApp('Own');
    const rival = await seedApp('Rival', own.id);
    await track(own.id, 'de', ['gewohnheit', 'routine', 'ziele']);
    await refresh(rival.id, 'de');

    await lost(rival.id, 'de');

    const [row] = await rows('app.unlisted_market');
    expect(row.payload).toMatchObject({
      trackedKeywords: 3,
      app: { isCompetitor: true },
    });
  });

  it('delivers an own delisting in the owned job and a competitor one beside its primary', async () => {
    const own = await seedApp('Own');
    const rival = await seedApp('Rival', own.id);
    const hook = (
      await api
        .post('/webhooks')
        .send({
          url: 'https://hooks.example.com/availability',
          events: ['app.delisted', 'metadata.changed'],
        })
        .expect(201)
    ).body as WebhookItem;
    await lost(own.id);
    await lost(rival.id);

    await api.post('/alerts/flush').expect(201);

    const jobs = (
      await app
        .get<Queue<DeliverAlertPayload>>(getQueueToken(QUEUES.ALERTS), {
          strict: false,
        })
        .getJobs(['wait', 'paused', 'delayed', 'waiting-children'])
    ).filter((job) => job.data.webhookId === hook.id);
    const scoped = (scope: string) =>
      jobs.find(
        (job) => (job.data.payload as AlertBatchPayload).scope === scope,
      )?.data.payload as AlertBatchPayload;
    expect(scoped('owned_apps').apps[0].availability).toEqual([
      expect.objectContaining({ event: 'app.delisted' }),
    ]);
    expect(scoped('competitors').apps[0].competitors[0].availability).toEqual([
      expect.objectContaining({ event: 'app.delisted' }),
    ]);
  });

  it('queues one instant job per event', async () => {
    const config = app.get(ConfigService);
    const read: (key: string) => unknown = config.get.bind(config);
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string): unknown =>
        key === 'ALERT_DELIVERY' ? 'instant' : read(key),
      );
    const own = await seedApp('Own');
    const hook = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/instant',
        events: ['app.delisted'],
      },
    });

    await lost(own.id);

    const jobs = (
      await app
        .get<Queue<DeliverAlertPayload>>(getQueueToken(QUEUES.ALERTS), {
          strict: false,
        })
        .getJobs(['wait', 'paused'])
    ).filter((job) => job.data.webhookId === hook.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.payload).toMatchObject({ event: 'app.delisted' });
  });
});
