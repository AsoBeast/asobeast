import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient, Store } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import {
  APP_RUN_STAGES,
  type AppRunStatus,
  FIRST_RUN_HISTORY_DAYS,
  FIRST_RUN_STAGES,
  type FirstRunStageStatus,
  type FirstRunStatus,
} from '@asobeast/shared';
import { AppModule } from '../src/app.module';
import { asWorkspace } from './helpers/tenancy';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import {
  closeWorkers,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  type CheckCategoryPayload,
  JOBS,
  QUEUES,
  resolveSubtitleJobId,
} from '../src/jobs/jobs.types';
import { CategoryRanksService } from '../src/category-ranks/category-ranks.service';
import { ChartCaptureService } from '../src/charts/chart-capture.service';
import { DailyBudgetService } from '../src/jobs/daily-budget.service';
import { PipelineService } from '../src/jobs/pipeline.service';
import { PipelineWorker } from '../src/jobs/pipeline.worker';
import { requestsFor } from '../src/jobs/request-weights';
import { utcToday } from '../src/rankings/rankings.support';
import { scrapedAppStoreRaw } from '../src/store-providers/app-store-scraped.fixture';

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
    await closeWorkers(app);
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

  it('schedules chart checks for an App Store app stored the way the scraper maps it', async () => {
    const appId = await seedApp(Store.APP_STORE, 'apple-charts');
    await prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Charts',
        description: 'Fixture description',
        raw: (await scrapedAppStoreRaw()) as Prisma.InputJsonObject,
      },
    });

    const response = await api.post(`/apps/${appId}/run-daily`).expect(202);

    expect(response.body).toMatchObject({ enqueued: { categories: 6 } });
    const charts = (await jobsOn(QUEUES.APP_STORE))
      .filter((job) => job.name === JOBS.CHECK_CATEGORY)
      .map((job) => job.data as { collection: string; genre: string });
    expect(
      charts.map(({ collection, genre }) => `${collection}:${genre}`).sort(),
    ).toEqual([
      'free:6027',
      'free:overall',
      'grossing:6027',
      'grossing:overall',
      'paid:6027',
      'paid:overall',
    ]);
  });

  it('counts a followed chart as one more category job unless an app already sits in it', async () => {
    await prisma.chartFollow.deleteMany({});
    const appId = await seedApp(Store.APP_STORE, 'apple-followed');
    await prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Charts',
        description: 'Fixture description',
        raw: (await scrapedAppStoreRaw()) as Prisma.InputJsonObject,
      },
    });
    const follow = (genre: string, collection = 'free') =>
      prisma.chartFollow.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          country: 'us',
          collection,
          genre,
          device: 'iphone',
        },
      });
    const categories = async () =>
      (await asWorkspace(app, () => budget.estimate())).categories;

    const before = await categories();
    await follow('6014');
    const followed = await categories();
    await follow('6014', 'paid');
    const secondKind = await categories();
    await follow('6027');
    const alreadyCharted = await categories();
    await prisma.chartFollow.deleteMany({});

    expect([
      followed - before,
      secondKind - followed,
      alreadyCharted - secondKind,
    ]).toEqual([1, 1, 0]);
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

  it('counts a read of a shipped localization that a tracked market reads', async () => {
    const appId = await seedApp(Store.APP_STORE, 'apple-swiss');
    const keyword = await prisma.keyword.create({
      data: { text: 'notes', store: Store.APP_STORE, country: 'ch' },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
    const before = await asWorkspace(app, () => budget.estimate());

    await prisma.appLocalization.create({
      data: {
        appId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'it',
        origin: 'manual',
      },
    });
    const after = await asWorkspace(app, () => budget.estimate());

    expect(after.localizations).toBe((before.localizations ?? 0) + 1);
    expect(after.total).toBe(before.total + 1);
  });

  it('schedules the weekly localization sweep', async () => {
    await app.get(PipelineWorker).registerSchedules();

    const schedulers = await queue(QUEUES.PIPELINE).getJobSchedulers();

    expect(schedulers).toContainEqual(
      expect.objectContaining({
        key: 'localization-sweep',
        pattern: '0 7 * * 1',
        name: JOBS.LOCALIZATION_SWEEP,
      }),
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

    it('keeps the listing waiting while a subtitle backfill is queued', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-subtitle-backfill');
      await seedSnapshot(appId, 120);
      const job = await queue(QUEUES.APP_STORE).add(
        JOBS.RESOLVE_SUBTITLE,
        { appId, snapshotId: 'pending', workspaceId: DEFAULT_WORKSPACE_ID },
        { jobId: resolveSubtitleJobId(appId), delay: 60_000 },
      );

      expect(stageOf(await firstRunOf(appId), 'metadata').complete).toBe(false);

      await job.remove();
      expect(stageOf(await firstRunOf(appId), 'metadata').complete).toBe(true);
    });

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

  describe("today's run of one app", () => {
    const runOf = async (appId: string): Promise<AppRunStatus> =>
      (await api.get(`/apps/${appId}/run-status`).expect(200))
        .body as AppRunStatus;

    const stageOf = (status: AppRunStatus, stage: string) =>
      status.stages.find((row) => row.stage === stage);

    const trackMore = async (appId: string, texts: string[]) => {
      for (const text of texts) {
        const keyword = await prisma.keyword.create({
          data: { text, store: Store.APP_STORE, country: 'us' },
        });
        await prisma.trackedKeyword.create({
          data: { appId, keywordId: keyword.id, source: 'MANUAL' },
        });
      }
    };

    it('answers the stages in contract order with totals from the tracked keywords', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-run-status');
      await trackMore(appId, ['journal', 'diary']);

      const status = await runOf(appId);

      expect(status.stages.map((row) => row.stage)).toEqual([
        ...APP_RUN_STAGES,
      ]);
      expect(stageOf(status, 'keywords')).toEqual({
        stage: 'keywords',
        ready: 0,
        total: 3,
        complete: false,
      });
      expect(stageOf(status, 'listings')).toMatchObject({
        ready: 0,
        total: 1,
      });
      expect(status).toMatchObject({
        appId,
        lastCaptureAt: null,
      });
      expect(['running', 'delayed']).toContain(status.state);
    });

    it('advances the keywords stage as a rank check lands', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-run-advance');
      const { keywordId } = await prisma.trackedKeyword.findFirstOrThrow({
        where: { appId },
        select: { keywordId: true },
      });
      await prisma.keywordRanking.create({
        data: {
          appId,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId,
          date: utcToday(),
          position: 4,
        },
      });

      const status = await runOf(appId);

      expect(stageOf(status, 'keywords')).toMatchObject({
        ready: 1,
        total: 1,
        complete: true,
      });
      expect(status.lastCaptureAt).not.toBeNull();
    });

    it('counts the listing captured today', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-run-listing');
      await prisma.appSnapshot.create({
        data: { appId, title: 'Fixture', description: 'Fixture', raw: {} },
      });

      const status = await runOf(appId);

      expect(stageOf(status, 'listings')).toMatchObject({
        ready: 1,
        total: 1,
        complete: true,
      });
    });

    it('completes the charts stage once the daily run read every chart', async () => {
      const appId = await seedApp(Store.APP_STORE, 'apple-run-charts');
      await prisma.appSnapshot.create({
        data: {
          appId,
          title: 'Charts',
          description: 'Fixture description',
          raw: (await scrapedAppStoreRaw()) as Prisma.InputJsonObject,
        },
      });
      const { keywordId } = await prisma.trackedKeyword.findFirstOrThrow({
        where: { appId },
        select: { keywordId: true },
      });
      await prisma.keywordRanking.create({
        data: {
          appId,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId,
          date: utcToday(),
          position: 4,
        },
      });
      await api.post(`/apps/${appId}/run-daily`).expect(202);
      const charts = (await jobsOn(QUEUES.APP_STORE)).filter(
        (job) => job.name === JOBS.CHECK_CATEGORY,
      );
      const capture = jest
        .spyOn(app.get(ChartCaptureService), 'captureToday')
        .mockResolvedValue({ depth: 100, entries: [] } as never);
      try {
        for (const job of charts) {
          await asWorkspace(app, () =>
            app
              .get(CategoryRanksService)
              .checkCategory(job.data as CheckCategoryPayload),
          );
        }
      } finally {
        capture.mockRestore();
      }

      const status = await runOf(appId);

      expect(charts).toHaveLength(6);
      expect(await prisma.categoryRank.count({ where: { appId } })).toBe(4);
      expect(stageOf(status, 'categories')).toEqual({
        stage: 'categories',
        ready: 4,
        total: 4,
        complete: true,
      });
      expect(status.state).toBe('complete');
    });

    it('answers 404 for an unknown app and for an app of another workspace', async () => {
      await prisma.workspace.upsert({
        where: { id: OTHER_WORKSPACE_ID },
        update: {},
        create: { id: OTHER_WORKSPACE_ID, name: 'Other' },
      });
      const other = await prisma.app.create({
        data: {
          workspaceId: OTHER_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: 'apple-run-other',
          country: 'us',
          name: 'Other',
          isCompetitor: false,
        },
      });

      await api.get('/apps/missing/run-status').expect(404);
      await api.get(`/apps/${other.id}/run-status`).expect(404);
    });

    it('answers a competitor app like any other', async () => {
      const primaryAppId = await seedApp(Store.APP_STORE, 'apple-run-primary');
      const rival = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: 'apple-run-rival',
          country: 'us',
          name: 'Rival',
          isCompetitor: true,
          primaryAppId,
        },
      });

      const status = await runOf(rival.id);

      expect(stageOf(status, 'listings')).toMatchObject({ total: 1 });
      expect(stageOf(status, 'keywords')).toMatchObject({ total: 0 });
    });
  });
});
