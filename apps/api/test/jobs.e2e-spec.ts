import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { BullExplorer } from '@nestjs/bullmq/dist/bull.explorer';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { AppModule } from '../src/app.module';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { DailyBudgetService } from '../src/jobs/daily-budget.service';
import { PipelineService } from '../src/jobs/pipeline.service';
import { requestsFor } from '../src/jobs/request-weights';

describe('Pipeline store routing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pipeline: PipelineService;
  let budget: DailyBudgetService;

  const queue = (name: string): Queue =>
    app.get<Queue>(getQueueToken(name), { strict: false });

  const jobsOn = (name: string): Promise<Job[]> =>
    queue(name).getJobs(['wait', 'paused', 'delayed']);

  const seedApp = async (store: Store, storeAppId: string): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId,
        country: 'us',
        name: storeAppId,
        isCompetitor: false,
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'notes', store, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: created.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    return created.id;
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.get(BullExplorer, { strict: false }).onApplicationShutdown();
    await pauseQueues(app);

    prisma = testDb();
    pipeline = app.get(PipelineService);
    budget = app.get(DailyBudgetService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
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

  it("routes each store's daily jobs onto its own queue", async () => {
    const appStoreId = await seedApp(Store.APP_STORE, 'apple-1');
    const gplayId = await seedApp(Store.GOOGLE_PLAY, 'gplay-1');

    await asWorkspace(app, () => pipeline.fanOutDaily());

    const appStoreJobs = await jobsOn(QUEUES.APP_STORE);
    const gplayJobs = await jobsOn(QUEUES.GPLAY);

    const refreshIds = (jobs: Job[]): string[] =>
      jobs
        .filter((job) => job.name === JOBS.REFRESH_APP)
        .map((job) => (job.data as { appId: string }).appId);

    expect(refreshIds(appStoreJobs)).toEqual([appStoreId]);
    expect(refreshIds(gplayJobs)).toEqual([gplayId]);

    expect(appStoreJobs.map((job) => job.name).sort()).toEqual(
      [JOBS.CHECK_KEYWORD, JOBS.REFRESH_APP, JOBS.SYNC_REVIEWS].sort(),
    );
    expect(gplayJobs.map((job) => job.name).sort()).toEqual(
      [JOBS.CHECK_KEYWORD, JOBS.REFRESH_APP, JOBS.SYNC_REVIEWS].sort(),
    );
  });

  it('reports a per-store budget that sums to the top-level totals', async () => {
    await seedApp(Store.APP_STORE, 'apple-1');

    const appStoreOnly = await asWorkspace(app, () => budget.estimate());
    const appStoreRow = appStoreOnly.stores.find(
      (row) => row.store === 'APP_STORE',
    );
    const gplayRow = appStoreOnly.stores.find(
      (row) => row.store === 'GOOGLE_PLAY',
    );

    expect(appStoreOnly.stores).toHaveLength(2);
    expect(appStoreRow).toMatchObject({
      apps: appStoreOnly.apps,
      keywords: appStoreOnly.keywords,
      categories: appStoreOnly.categories,
      reviews: appStoreOnly.reviews,
      total: appStoreOnly.total,
    });
    expect(gplayRow?.total).toBe(0);
    expect(appStoreOnly.utilization).toBe(appStoreRow?.utilization);

    await seedApp(Store.GOOGLE_PLAY, 'gplay-1');
    const mixed = await asWorkspace(app, () => budget.estimate());
    const mixedAppStore = mixed.stores.find((row) => row.store === 'APP_STORE');
    const mixedGplay = mixed.stores.find((row) => row.store === 'GOOGLE_PLAY');

    expect(mixedAppStore?.total).toBe(appStoreRow?.total);
    expect(mixedGplay?.total).toBe(
      requestsFor('GOOGLE_PLAY', {
        apps: mixedGplay?.apps ?? 0,
        keywords: mixedGplay?.keywords ?? 0,
        categories: mixedGplay?.categories ?? 0,
        reviews: mixedGplay?.reviews ?? 0,
      }),
    );
    expect(mixed.total).toBe(
      (mixedAppStore?.total ?? 0) + (mixedGplay?.total ?? 0),
    );
    expect(mixed.capacityPerDay).toBe(
      (mixedAppStore?.capacityPerDay ?? 0) + (mixedGplay?.capacityPerDay ?? 0),
    );
    expect(mixed.utilization).toBe(
      Math.max(mixedAppStore?.utilization ?? 0, mixedGplay?.utilization ?? 0),
    );
  });
});
