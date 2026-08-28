import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { BullExplorer } from '@nestjs/bullmq/dist/bull.explorer';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import {
  FIRST_RUN_HISTORY_DAYS,
  FIRST_RUN_STAGES,
  type FirstRunStageStatus,
  type FirstRunStatus,
} from '@asobeast/shared';
import { AppModule } from '../src/app.module';
import { asWorkspace } from './helpers/tenancy';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { DailyBudgetService } from '../src/jobs/daily-budget.service';
import { PipelineService } from '../src/jobs/pipeline.service';
import { requestsFor } from '../src/jobs/request-weights';

const OTHER_WORKSPACE_ID = 'ws_jobs_other';

describe('Pipeline store routing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pipeline: PipelineService;
  let budget: DailyBudgetService;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

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
    useCookies(app);
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
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await obliterateQueues(app);
    await pauseQueues(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE_ID } });
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

  describe('first run readiness', () => {
    const seedSnapshot = (appId: string, ratingCount: number | null) =>
      prisma.appSnapshot.create({
        data: {
          appId,
          title: 'Fixture',
          description: 'Fixture description',
          ratingCount,
          raw: {},
        },
      });

    const seedRankings = async (appId: string): Promise<number> => {
      const tracked = await prisma.trackedKeyword.findMany({
        where: { appId, active: true },
        select: { keywordId: true },
      });
      for (const { keywordId } of tracked) {
        await prisma.keywordRanking.create({
          data: {
            appId,
            workspaceId: DEFAULT_WORKSPACE_ID,
            keywordId,
            date: new Date('2026-08-10T00:00:00Z'),
            position: 12,
          },
        });
      }
      return tracked.length;
    };

    const firstRunOf = async (appId: string): Promise<FirstRunStatus> => {
      const response = await api.get(`/apps/${appId}/first-run`).expect(200);
      return response.body as FirstRunStatus;
    };

    const stageOf = (
      status: FirstRunStatus,
      stage: string,
    ): FirstRunStageStatus => {
      const found = status.stages.find((row) => row.stage === stage);
      if (!found) throw new Error(`missing stage ${stage}`);
      return found;
    };

    it('refuses an app id it cannot resolve', async () => {
      await api.get('/apps/does-not-exist/first-run').expect(404);
    });

    it('carries exactly the contract stages, in contract order', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-first-run');
      await seedSnapshot(appId, 120);

      const status = await firstRunOf(appId);

      expect(status.appId).toBe(appId);
      expect(status.stages.map((stage) => stage.stage)).toEqual([
        ...FIRST_RUN_STAGES,
      ]);
    });

    it('waits on rankings and names when the daily run collects them', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-waiting');
      await seedSnapshot(appId, 120);

      const status = await firstRunOf(appId);
      const rankings = stageOf(status, 'rankings');

      expect(status.complete).toBe(false);
      expect(rankings).toMatchObject({ ready: 0, total: 1, complete: false });
      expect(Number.isNaN(Date.parse(rankings.expectedBy ?? ''))).toBe(false);
      expect(stageOf(status, 'history')).toMatchObject({
        ready: 0,
        total: FIRST_RUN_HISTORY_DAYS,
        complete: false,
      });
    });

    it('stops promising a time once the captures land', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-captured');
      await seedSnapshot(appId, 120);
      const tracked = await seedRankings(appId);

      const rankings = stageOf(await firstRunOf(appId), 'rankings');

      expect(rankings).toMatchObject({
        ready: tracked,
        total: tracked,
        complete: true,
        expectedBy: null,
      });
    });

    it('expects no reviews from a listing the store reports no ratings for', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-unrated');
      await seedSnapshot(appId, 0);

      expect(stageOf(await firstRunOf(appId), 'reviews')).toMatchObject({
        ready: 0,
        total: 0,
        complete: true,
        expectedBy: null,
      });
    });

    it('never reports an app owned by another workspace', async () => {
      await prisma.workspace.upsert({
        where: { id: OTHER_WORKSPACE_ID },
        update: {},
        create: { id: OTHER_WORKSPACE_ID, name: 'Other' },
      });
      const other = await prisma.app.create({
        data: {
          workspaceId: OTHER_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: 'apple-other',
          country: 'us',
          name: 'Other',
          isCompetitor: false,
        },
      });

      await api.get(`/apps/${other.id}/first-run`).expect(404);
    });
  });
});
