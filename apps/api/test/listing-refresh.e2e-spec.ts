import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  CompetitorItem,
  SnapshotDiffResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AlertsDispatcher } from '../src/alerts/alerts.dispatcher';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { RetentionService } from '../src/jobs/retention.service';
import { StoreAppNotFoundError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  title: 'Fixture',
  subtitle: 'Fixture subtitle',
  description: 'Fixture description',
  iconUrl: 'https://example.com/icon.png',
  ratingAvg: 4.5,
  ratingCount: 10,
  version: '1.0.0',
  raw: { source: 'fixture' },
  searchable: true,
};

class ListingRegistry {
  getAppCalls: Array<{ storeAppId: string; country: string }> = [];
  titles = new Map<string, string>();
  subtitleUnavailable = false;
  failWith: Error | null = null;

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string, country: string) => {
        this.getAppCalls.push({ storeAppId, country });
        if (this.failWith) return Promise.reject(this.failWith);
        return Promise.resolve({
          ...FIXTURE,
          store,
          storeAppId,
          title: this.titles.get(country) ?? `Fixture ${country}`,
          ...(this.subtitleUnavailable
            ? { subtitle: undefined, subtitleUnavailable: true }
            : {}),
        });
      },
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

describe('market listing refresh (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new ListingRegistry();

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
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
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    registry.getAppCalls = [];
    registry.titles.clear();
    registry.subtitleUnavailable = false;
    registry.failWith = null;
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const importApp = async (): Promise<string> => {
    const response = await api
      .post('/apps')
      .send({ url: 'https://apps.apple.com/us/app/fixture/id1234567890' })
      .expect(201);
    registry.getAppCalls = [];
    return (response.body as AppDetail).id;
  };

  const trackIn = async (appId: string, country: string) => {
    const keyword = await prisma.keyword.create({
      data: { text: 'gewohnheit', store: Store.APP_STORE, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
  };

  const listings = (appId: string, country: string | null) =>
    prisma.appSnapshot.findMany({
      where: { appId, country },
      orderBy: { capturedAt: 'asc' },
    });

  it('captures the listing of a market the app tracks keywords in', async () => {
    const appId = await importApp();
    await trackIn(appId, 'de');

    const response = await api
      .post(`/apps/${appId}/refresh?country=de`)
      .expect(200);

    const body = response.body as SnapshotDiffResult;
    const market = await listings(appId, 'de');
    expect(body).toEqual({
      snapshotId: market[0].id,
      changes: [],
      country: 'de',
    });
    expect(registry.getAppCalls).toEqual([
      { storeAppId: '1234567890', country: 'de' },
    ]);
    expect(market.map((row) => row.title)).toEqual(['Fixture de']);
    await expect(listings(appId, null)).resolves.toHaveLength(1);
    await expect(prisma.changeEvent.count()).resolves.toBe(0);
  });

  it('refreshes the home listing when the home market is named', async () => {
    const appId = await importApp();

    const response = await api
      .post(`/apps/${appId}/refresh?country=us`)
      .expect(200);

    expect((response.body as SnapshotDiffResult).country).toBe('us');
    await expect(listings(appId, null)).resolves.toHaveLength(2);
    await expect(listings(appId, 'de')).resolves.toHaveLength(0);
  });

  it('refuses a market with no tracked keyword and asks the store nothing', async () => {
    const appId = await importApp();

    const response = await api
      .post(`/apps/${appId}/refresh?country=fr`)
      .expect(400);

    expect((response.body as ApiErrorEnvelope).message).toContain('fr');
    expect(registry.getAppCalls).toEqual([]);
  });

  it('refuses a code that is not a storefront of the store', async () => {
    const appId = await importApp();

    const response = await api
      .post(`/apps/${appId}/refresh?country=zz`)
      .expect(400);

    expect((response.body as ApiErrorEnvelope).message).toMatch(
      /not an App Store storefront/,
    );
    expect(registry.getAppCalls).toEqual([]);
  });

  it('spends a refresh credit only on a market it accepts', async () => {
    const appId = await importApp();
    await trackIn(appId, 'de');
    const consume = jest.spyOn(app.get(OnDemandLimiter), 'consume');

    await api.post(`/apps/${appId}/refresh?country=fr`).expect(400);
    await api.post(`/apps/${appId}/refresh?country=zz`).expect(400);
    await api.post('/apps/missing/refresh').expect(404);
    expect(consume).not.toHaveBeenCalled();

    await api.post(`/apps/${appId}/refresh?country=de`).expect(200);
    expect(consume.mock.calls).toEqual([['refresh']]);
  });

  it('records a market change without an alert or a home side effect', async () => {
    const appId = await importApp();
    await trackIn(appId, 'de');
    await api.post(`/apps/${appId}/refresh?country=de`).expect(200);
    const trackedBefore = await prisma.trackedKeyword.count();
    registry.titles.set('de', 'Neu');
    const dispatch = jest.spyOn(app.get(AlertsDispatcher), 'dispatch');

    const response = await api
      .post(`/apps/${appId}/refresh?country=de`)
      .expect(200);

    expect(
      (response.body as SnapshotDiffResult).changes.map(
        (change) => change.field,
      ),
    ).toEqual(['title']);
    const events = await prisma.changeEvent.findMany({
      select: { country: true, field: true, before: true, after: true },
    });
    expect(events).toEqual([
      { country: 'de', field: 'title', before: 'Fixture de', after: 'Neu' },
    ]);
    expect(dispatch).not.toHaveBeenCalled();
    const stored = await prisma.app.findUniqueOrThrow({
      where: { id: appId },
    });
    expect(stored.name).toBe('Fixture us');
    await expect(prisma.trackedKeyword.count()).resolves.toBe(trackedBefore);
  });

  it('refreshes a competitor in the market of its primary', async () => {
    const appId = await importApp();
    const added = await api
      .post(`/apps/${appId}/competitors`)
      .send({ url: 'https://apps.apple.com/us/app/rival/id2222222222' })
      .expect(201);
    const competitorId = (added.body as CompetitorItem).id;
    await trackIn(appId, 'de');

    await api.post(`/apps/${competitorId}/refresh?country=de`).expect(200);

    await expect(listings(competitorId, 'de')).resolves.toHaveLength(1);
  });

  it('keeps the first market snapshot without a subtitle the page could not give', async () => {
    const appId = await importApp();
    await trackIn(appId, 'de');
    registry.subtitleUnavailable = true;

    await api.post(`/apps/${appId}/refresh?country=de`).expect(200);

    const [market] = await listings(appId, 'de');
    expect(market.subtitle).toBeNull();
  });

  it('answers 404 when the store no longer lists the app in that market', async () => {
    const appId = await importApp();
    await trackIn(appId, 'de');
    registry.failWith = new StoreAppNotFoundError(
      Store.APP_STORE,
      '1234567890',
    );

    await api.post(`/apps/${appId}/refresh?country=de`).expect(404);

    await expect(listings(appId, 'de')).resolves.toHaveLength(0);
  });

  it('keeps the body of a refresh without a market', async () => {
    const appId = await importApp();

    const response = await api.post(`/apps/${appId}/refresh`).expect(200);

    const body = response.body as SnapshotDiffResult;
    const home = await listings(appId, null);
    expect(home).toHaveLength(2);
    expect(body).toEqual({
      snapshotId: home[1].id,
      changes: [],
      country: 'us',
    });
  });

  it('keeps the newest snapshot of every market', async () => {
    const appId = await importApp();
    await prisma.appSnapshot.deleteMany({ where: { appId } });
    const seeded = [
      [null, '2025-01-01'],
      [null, '2025-02-01'],
      ['de', '2025-01-05'],
      ['de', '2025-02-05'],
    ] as const;
    await prisma.appSnapshot.createMany({
      data: seeded.map(([country, day]) => ({
        appId,
        country,
        title: `Listing ${day}`,
        description: 'Description',
        raw: {},
        capturedAt: new Date(`${day}T00:00:00.000Z`),
      })),
    });

    await app.get(RetentionService).prune();

    const remaining = await prisma.appSnapshot.findMany({
      where: { appId },
      orderBy: { capturedAt: 'asc' },
      select: { country: true, capturedAt: true },
    });
    expect(remaining).toEqual([
      { country: null, capturedAt: new Date('2025-02-01T00:00:00.000Z') },
      { country: 'de', capturedAt: new Date('2025-02-05T00:00:00.000Z') },
    ]);
  });
});
