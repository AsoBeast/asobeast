import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AlertsDispatcher } from '../src/alerts/alerts.dispatcher';
import { AlertsModule } from '../src/alerts/alerts.module';
import { InstantAlertRelay } from '../src/alerts/instant-alert-relay';
import { InstantDeliveries } from '../src/alerts/instant-deliveries';
import { AppModule } from '../src/app.module';
import { ListingCaptureService } from '../src/apps/listing-capture.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverAlertPayload, JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreAppNotFoundError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const DAY_MS = 86_400_000;
const UNCHANGED_RATING = {
  ratingAvg: 4.38,
  ratingCount: 830,
  version: '1.1.0',
};
const DROPPED_RATING = { ratingAvg: 4.3, ratingCount: 840, version: '1.1.0' };

class LossRegistry {
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

class HeldRegistry {
  missing = false;
  private holding: (() => void) | null = null;
  private release: ((error: Error) => void) | null = null;

  holdNextRead(): Promise<void> {
    return new Promise((resolve) => {
      this.holding = resolve;
    });
  }

  answerHeldRead(error: Error): void {
    this.release?.(error);
    this.release = null;
  }

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) => this.read(store, storeAppId),
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
      topCharts: () => Promise.resolve([]),
      reviews: () => Promise.resolve([]),
      availability: () => Promise.resolve([]),
      developerApps: () => Promise.resolve([]),
    };
  }

  private read(store: Store, storeAppId: string): Promise<NormalizedApp> {
    if (this.holding) {
      const held = new Promise<NormalizedApp>((_, reject) => {
        this.release = reject;
      });
      this.holding();
      this.holding = null;
      return held;
    }
    return new LossRegistry().get(store).getApp(storeAppId, 'us');
  }
}

describe('transition alert durability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let capture: ListingCaptureService;
  const registry = new LossRegistry();
  const held = new HeldRegistry();
  let registryInUse: LossRegistry | HeldRegistry = registry;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue({ get: (store: Store) => registryInUse.get(store) })
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
  });

  beforeEach(async () => {
    registry.missing = false;
    registry.rating = UNCHANGED_RATING;
    registryInUse = registry;
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AlertEvent", "Webhook" RESTART IDENTITY CASCADE',
    );
    await alertsQueue().obliterate({ force: true });
    await alertsQueue().pause();
  });

  afterAll(async () => {
    await clearFault();
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

  const failFirstDelivery = () =>
    jest
      .spyOn(app.get(InstantDeliveries), 'enqueue')
      .mockRejectedValueOnce(new Error('redis went away'));

  const deliverPending = () => app.get(InstantAlertRelay).relayEveryWorkspace();

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

  const track = async (appId: string, country: string, texts: string[]) => {
    for (const text of texts) {
      const keyword = await prisma.keyword.create({
        data: { text, store: Store.APP_STORE, country },
      });
      await prisma.trackedKeyword.create({
        data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
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

  const drops = () => rows('rating.dropped');

  const seedRated = ({
    name = 'Rated',
    primaryAppId = null as string | null,
  } = {}) => {
    const now = Date.now();
    return prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `${name}-store`,
        country: 'us',
        name,
        isCompetitor: primaryAppId !== null,
        primaryAppId,
        snapshots: {
          create: Array.from({ length: 8 }, (_, index) => ({
            title: name,
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

  const homeSnapshots = (appId: string) =>
    prisma.appSnapshot.count({ where: { appId, country: null } });

  const faultOnce = async () => {
    await prisma.$executeRawUnsafe('CREATE SEQUENCE e2e_alert_fault');
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SEQUENCE e2e_alert_fault TO asobeast_app',
    );
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION e2e_alert_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF nextval('e2e_alert_fault') = 1 THEN
          RAISE EXCEPTION 'e2e alert fault';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER e2e_alert_fault BEFORE INSERT ON "AlertEvent" FOR EACH ROW EXECUTE FUNCTION e2e_alert_fault()',
    );
  };

  const clearFault = async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS e2e_alert_fault ON "AlertEvent"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS e2e_alert_fault()');
    await prisma.$executeRawUnsafe('DROP SEQUENCE IF EXISTS e2e_alert_fault');
  };

  const lostWhileFound = async (listed: { id: string; storeAppId: string }) => {
    registryInUse = held;
    const heldRead = held.holdNextRead();
    const notFound = refresh(listed.id);
    await heldRead;
    await refresh(listed.id);
    held.answerHeldRead(
      new StoreAppNotFoundError(Store.APP_STORE, listed.storeAppId),
    );
    await notFound;
  };

  describe('listing loss', () => {
    it('delivers an instant delisting whose first delivery failed, without another state change', async () => {
      instant();
      const hook = await subscribe();
      const own = await seedApp('Own');
      await refresh(own.id);
      failFirstDelivery();

      await lost(own.id);
      await deliverPending();
      await lost(own.id);
      await deliverPending();

      const jobs = await deliveriesTo(hook.id);
      expect(jobs).toHaveLength(1);
      const [job] = jobs;
      expect(job.data.payload.event).toBe('app.delisted');
      expect(job.data.payload).toMatchObject({ app: { id: own.id } });
      expect(await rows('app.delisted')).toHaveLength(1);
    });

    it('delivers an instant unlisted market whose first delivery failed, without another state change', async () => {
      instant();
      const hook = await subscribe();
      const own = await seedApp('Own');
      await track(own.id, 'de', ['gewohnheit']);
      await refresh(own.id, 'de');
      failFirstDelivery();

      await lost(own.id, 'de');
      await deliverPending();
      await lost(own.id, 'de');
      await deliverPending();

      const jobs = await deliveriesTo(hook.id);
      expect(jobs).toHaveLength(1);
      const [job] = jobs;
      expect(job.data.payload).toMatchObject({
        event: 'app.unlisted_market',
        market: 'de',
        trackedKeywords: 1,
      });
    });

    it('keeps a batched delisting whose dispatch after the loss never ran', async () => {
      const own = await seedApp('Own');
      await refresh(own.id);
      jest
        .spyOn(app.get(AlertsDispatcher), 'dispatch')
        .mockResolvedValueOnce(undefined);

      await lost(own.id);
      await lost(own.id);

      const recorded = await rows('app.delisted');
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatchObject({ flushedAt: null, flushId: null });
    });

    it('delivers each relayed alert once when the relay runs twice', async () => {
      instant();
      const hook = await subscribe();
      const own = await seedApp('Own');
      await refresh(own.id);

      await lost(own.id);
      const { alertEventId } = await prisma.alertRelay.findFirstOrThrow();
      await deliverPending();
      await prisma.alertRelay.create({
        data: { alertEventId, workspaceId: DEFAULT_WORKSPACE_ID },
      });
      await deliverPending();

      expect(await deliveriesTo(hook.id)).toHaveLength(1);
      expect(await prisma.alertRelay.count()).toBe(0);
    });

    it('never fails a capture whose alert write fails and still records the loss', async () => {
      const own = await seedApp('Own');
      await refresh(own.id);
      await faultOnce();
      try {
        await expect(lost(own.id)).resolves.toBeUndefined();
      } finally {
        await clearFault();
      }

      const stored = await prisma.app.findUniqueOrThrow({
        where: { id: own.id },
      });
      expect(stored.delistedAt).not.toBeNull();
      expect(await rows('app.delisted')).toEqual([]);
    });

    it('records the loss and its alert together under the listing lock', async () => {
      const own = await seedApp('Own');
      await refresh(own.id);

      await lostWhileFound(own);

      const stored = await prisma.app.findUniqueOrThrow({
        where: { id: own.id },
      });
      expect(stored.delistedAt).toBeNull();
      expect(await rows('app.delisted')).toEqual([]);
    });
  });

  describe('rating drop', () => {
    it('delivers an instant rating drop whose first delivery failed, without another state change', async () => {
      instant();
      const hook = await subscribe();
      const rated = await seedRated();
      registry.rating = DROPPED_RATING;
      failFirstDelivery();

      await refresh(rated.id);
      await deliverPending();
      await refresh(rated.id);
      await deliverPending();

      const jobs = await deliveriesTo(hook.id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.payload).toMatchObject({
        event: 'rating.dropped',
        dropTenths: 3,
      });
      expect(await drops()).toHaveLength(1);
    });

    it('keeps a batched rating drop whose dispatch after the snapshot never ran', async () => {
      const rated = await seedRated();
      registry.rating = DROPPED_RATING;
      jest
        .spyOn(app.get(AlertsDispatcher), 'dispatch')
        .mockResolvedValueOnce(undefined);

      await refresh(rated.id);
      await refresh(rated.id);

      const recorded = await drops();
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatchObject({ flushedAt: null, flushId: null });
    });

    it('never fails a capture whose rating drop alert write fails and still stores the snapshot', async () => {
      const rated = await seedRated();
      registry.rating = DROPPED_RATING;
      const before = await homeSnapshots(rated.id);
      await faultOnce();
      try {
        await expect(refresh(rated.id)).resolves.toMatchObject({
          snapshotId: expect.any(String) as string,
        });
      } finally {
        await clearFault();
      }

      expect(await homeSnapshots(rated.id)).toBe(before + 1);
      expect(await drops()).toEqual([]);
    });

    it('raises no rating drop for a competitor or a market capture', async () => {
      const own = await seedRated();
      const rival = await seedRated({ name: 'Rival', primaryAppId: own.id });
      await track(own.id, 'de', ['bewertung']);
      registry.rating = DROPPED_RATING;

      await refresh(rival.id);
      await refresh(own.id, 'de');
      await refresh(own.id, 'de');

      expect(await drops()).toEqual([]);
    });
  });
});
