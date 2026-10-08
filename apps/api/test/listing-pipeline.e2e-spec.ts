import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { DailyBudget, RunDailyResult } from '@asobeast/shared';
import { Job, Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppsService } from '../src/apps/apps.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreAppNotFoundError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { asWorkspace } from './helpers/tenancy';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '111',
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

class MarketRegistry {
  failWith: Error | null = null;

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string, country: string) =>
        this.failWith
          ? Promise.reject(this.failWith)
          : Promise.resolve({
              ...FIXTURE,
              store,
              storeAppId,
              title: `Fixture ${country}`,
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

describe('market listings in the daily pipeline (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new MarketRegistry();

  const refreshJobs = async (): Promise<Job[]> =>
    (
      await app
        .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
        .getJobs(['wait', 'delayed'])
    ).filter((job) => job.name === JOBS.REFRESH_APP);

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
    registry.failWith = null;
    await obliterateQueues(app);
    await pauseQueues(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'gewohnheit', store: Store.APP_STORE, country: 'de' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: primary.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    return { primary, rival };
  };

  const refreshListing = (appId: string, country: string) =>
    asWorkspace(app, () => app.get(AppsService).refreshListing(appId, country));

  it('queues a listing refresh per market for the app and its competitors', async () => {
    const { primary, rival } = await seed();

    const response = await api
      .post(`/apps/${primary.id}/run-daily`)
      .expect(202);

    expect((response.body as RunDailyResult).enqueued.apps).toBe(4);
    const jobs = (await refreshJobs()).map(
      (job) => job.data as { appId: string; country?: string },
    );
    expect(
      jobs
        .filter((data) => data.country === 'de')
        .map((data) => data.appId)
        .sort(),
    ).toEqual([primary.id, rival.id].sort());
    expect(jobs.filter((data) => data.country === undefined)).toHaveLength(2);
  });

  it('captures the market listing when the queued job runs', async () => {
    const { primary } = await seed();

    const diff = await refreshListing(primary.id, 'de');

    expect(diff?.country).toBe('de');
    await expect(
      prisma.appSnapshot.count({ where: { appId: primary.id, country: 'de' } }),
    ).resolves.toBe(1);
  });

  it('lets a market job finish quietly when the store has no such app', async () => {
    const { primary } = await seed();
    registry.failWith = new StoreAppNotFoundError(Store.APP_STORE, '111');

    await expect(refreshListing(primary.id, 'de')).resolves.toBeNull();
    await expect(
      prisma.appSnapshot.count({ where: { appId: primary.id } }),
    ).resolves.toBe(0);
    await expect(refreshListing(primary.id, 'us')).rejects.toThrow(
      StoreAppNotFoundError,
    );
  });

  it('counts market listings in the daily budget', async () => {
    await seed();

    const response = await api.get('/jobs/budget').expect(200);

    const budget = response.body as DailyBudget;
    expect(budget.apps).toBe(4);
    expect(budget.marketListings).toBe(2);
    expect(
      budget.stores.find((row) => row.store === 'APP_STORE')?.marketListings,
    ).toBe(2);
  });
});
