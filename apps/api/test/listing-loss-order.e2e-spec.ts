import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ListingCaptureService } from '../src/apps/listing-capture.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ScreenshotRecorder } from '../src/screenshots/screenshot-recorder';
import { StoreAppNotFoundError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

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
    if (this.missing) {
      return Promise.reject(new StoreAppNotFoundError(store, storeAppId));
    }
    return Promise.resolve({
      store,
      storeAppId,
      title: 'Listed',
      description: 'Listed app',
      raw: {},
      searchable: true,
    });
  }
}

describe('listing loss ordering (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let capture: ListingCaptureService;
  const registry = new HeldRegistry();

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

  const track = async (appId: string, country: string, text: string) => {
    const keyword = await prisma.keyword.create({
      data: { text, store: Store.APP_STORE, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
  };

  const refresh = (appId: string, country?: string) =>
    asWorkspace(app, () => capture.refreshListing(appId, country));

  const lostWhileFound = async (
    listed: { id: string; storeAppId: string },
    country?: string,
  ) => {
    const heldRead = registry.holdNextRead();
    const notFound = refresh(listed.id, country);
    await heldRead;
    await refresh(listed.id, country);
    registry.answerHeldRead(
      new StoreAppNotFoundError(Store.APP_STORE, listed.storeAppId),
    );
    await notFound;
  };

  const holdCaptureTransaction = () => {
    const recorder = app.get(ScreenshotRecorder);
    const record = recorder.record.bind(recorder);
    let entered: () => void = () => undefined;
    let release: () => void = () => undefined;
    const inside = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    jest.spyOn(recorder, 'record').mockImplementationOnce(async (...args) => {
      entered();
      await released;
      return record(...args);
    });
    return { inside, release };
  };

  const waitingForListingLock = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting FROM pg_locks
        WHERE locktype = 'advisory' AND NOT granted
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `;
      if (waiting > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('the loss write never waited for the listing lock');
  };

  const stored = (id: string) =>
    prisma.app.findUniqueOrThrow({ where: { id } });

  const rows = (event: string) =>
    prisma.alertEvent.findMany({ where: { event } });

  it('records no delisting when a capture found the app after the not found read started', async () => {
    const own = await seedApp('Own');
    await refresh(own.id);

    await lostWhileFound(own);

    expect((await stored(own.id)).delistedAt).toBeNull();
    expect(await rows('app.delisted')).toEqual([]);
  });

  it('keeps the app listed once a capture cleared an earlier delisting', async () => {
    const own = await seedApp('Own');
    await refresh(own.id);
    await prisma.app.update({
      where: { id: own.id },
      data: { delistedAt: new Date('2026-11-01T00:00:00.000Z') },
    });

    await lostWhileFound(own);

    expect((await stored(own.id)).delistedAt).toBeNull();
    expect(await rows('app.delisted')).toEqual([]);
  });

  it('records no unlisted market when a capture found the app there after the read started', async () => {
    const own = await seedApp('Own');
    await track(own.id, 'de', 'gewohnheit');
    await refresh(own.id, 'de');

    await lostWhileFound(own, 'de');

    expect((await stored(own.id)).unlistedMarkets).not.toContain('de');
    expect(await rows('app.unlisted_market')).toEqual([]);
  });

  it('records no loss for a competitor whose capture found it after the read started', async () => {
    const own = await seedApp('Own');
    const rival = await seedApp('Rival', own.id);
    await refresh(rival.id);

    await lostWhileFound(rival);

    expect((await stored(rival.id)).delistedAt).toBeNull();
    expect(await rows('app.delisted')).toEqual([]);
  });

  it('makes the loss write wait for a capture that is still committing', async () => {
    const own = await seedApp('Own');
    await refresh(own.id);
    const heldRead = registry.holdNextRead();
    const notFound = refresh(own.id);
    await heldRead;
    const committing = holdCaptureTransaction();
    const found = refresh(own.id);
    await committing.inside;

    registry.answerHeldRead(
      new StoreAppNotFoundError(Store.APP_STORE, own.storeAppId),
    );
    try {
      await waitingForListingLock();
    } finally {
      committing.release();
    }
    await Promise.all([found, notFound]);

    expect((await stored(own.id)).delistedAt).toBeNull();
    expect(await rows('app.delisted')).toEqual([]);
  });

  it('still records a loss read after the capture that found the app', async () => {
    const own = await seedApp('Own');
    await refresh(own.id);

    registry.missing = true;
    await refresh(own.id);

    expect((await stored(own.id)).delistedAt).not.toBeNull();
    expect(await rows('app.delisted')).toHaveLength(1);
  });
});
