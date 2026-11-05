import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  KeywordInspection,
  KeywordInspectionList,
} from '@asobeast/shared';
import { Job, Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  InspectKeywordPayload,
  inspectKeywordJobId,
  JOBS,
  QUEUES,
} from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { StoreRequestError } from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  NormalizedApp,
  SearchItem,
  StoreProvider,
} from '../src/store-providers/types';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';

const SEARCH: SearchItem[] = [
  {
    storeAppId: '100',
    title: 'Habit Tracker',
    developer: 'Streaks Inc',
    ratingAvg: 4.8,
    ratingCount: 250_000,
    updatedAt: new Date(),
  },
  {
    storeAppId: '200',
    title: 'Daily Planner',
    developer: 'Plans Ltd',
    ratingAvg: 4.1,
    ratingCount: 3_000,
  },
];

const DETAIL: NormalizedApp = {
  store: Store.GOOGLE_PLAY,
  storeAppId: 'com.example.habit',
  title: 'Habit Tracker',
  description: '',
  ratingCount: 10_000,
  raw: {},
  searchable: true,
};

class FakeRegistry {
  results: SearchItem[] = SEARCH;
  searchFails = false;
  searches = 0;

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: () => Promise.resolve(DETAIL),
      search: () => {
        this.searches += 1;
        return this.searchFails
          ? Promise.reject(new StoreRequestError(store, 'search', 'timeout'))
          : Promise.resolve(this.results);
      },
      suggest: (term: string) =>
        Promise.resolve(
          term.length < 3
            ? []
            : [{ term: 'habit tracker' }, { term: 'habit tracker app' }],
        ),
      similar: () => Promise.resolve([]),
      topCharts: () => Promise.resolve([]),
      reviews: () => Promise.resolve([]),
      availability: () => Promise.resolve({}),
      developerApps: () => Promise.resolve([]),
    } as unknown as StoreProvider;
  }
}

describe('KeywordInspectionsController (e2e)', () => {
  const registry = new FakeRegistry();
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const queue = (store: Store) =>
    app.get<Queue>(
      getQueueToken(
        store === Store.GOOGLE_PLAY ? QUEUES.GPLAY : QUEUES.APP_STORE,
      ),
      { strict: false },
    );

  const runJob = (
    inspectionId: string,
    { store = Store.APP_STORE, final = true } = {},
  ) =>
    app.get(StoreJobsHandler).handle({
      name: JOBS.INSPECT_KEYWORD,
      id: inspectKeywordJobId(inspectionId),
      queueName: store === Store.GOOGLE_PLAY ? QUEUES.GPLAY : QUEUES.APP_STORE,
      attemptsMade: 0,
      opts: { attempts: final ? 1 : 3 },
      data: {
        inspectionId,
        workspaceId: DEFAULT_WORKSPACE_ID,
      } satisfies InspectKeywordPayload,
    } as unknown as Job);

  const inspect = async (
    body: Record<string, unknown>,
  ): Promise<KeywordInspection> => {
    const response = await api
      .post('/keyword-inspections')
      .send(body)
      .expect(202);
    return response.body as KeywordInspection;
  };

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
    registry.results = SEARCH;
    registry.searchFails = false;
    registry.searches = 0;
    for (const store of [Store.APP_STORE, Store.GOOGLE_PLAY]) {
      await queue(store).obliterate({ force: true });
      await queue(store).pause();
    }
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Keyword", "KeywordInspection" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('queues a pending inspection without reaching the store', async () => {
    const pending = await inspect({
      keyword: '  Habit Tracker ',
      store: 'APP_STORE',
      country: 'us',
    });

    expect(pending).toMatchObject({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
      status: 'PENDING',
      completedAt: null,
      volume: null,
      results: [],
      previous: null,
    });
    expect(registry.searches).toBe(0);
    const job = await queue(Store.APP_STORE).getJob(
      inspectKeywordJobId(pending.id),
    );
    expect(job?.name).toBe(JOBS.INSPECT_KEYWORD);
  });

  it('answers the pending inspection instead of queuing a second one', async () => {
    const first = await inspect({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
    });
    const second = await inspect({
      keyword: 'HABIT tracker',
      store: 'APP_STORE',
      country: 'us',
    });

    expect(second.id).toBe(first.id);
    expect(await prisma.keywordInspection.count()).toBe(1);
  });

  it('completes an inspection with results, suggestions and scores', async () => {
    const pending = await inspect({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
    });

    await runJob(pending.id);

    const done = (
      await api.get(`/keyword-inspections/${pending.id}`).expect(200)
    ).body as KeywordInspection;
    expect(done.status).toBe('DONE');
    expect(done.completedAt).not.toBeNull();
    expect(done.resultCount).toBe(2);
    expect(done.results.map((result) => result.title)).toEqual([
      'Habit Tracker',
      'Daily Planner',
    ]);
    expect(done.results[0]).toMatchObject({
      position: 1,
      titleMatch: 'exact',
      ratingCount: 250_000,
    });
    expect(done.suggestions.map((item) => item.term)).toEqual([
      'habit tracker',
      'habit tracker app',
    ]);
    expect(done.volume).toEqual(expect.any(Number));
    expect(done.difficulty100).toEqual(expect.any(Number));
    expect(done.provenance).toMatchObject({
      source: 'APPLE_SEARCH_SIGNALS',
    });
    expect(done.competition).toMatchObject({
      topCount: 2,
      exactTitleMatches: 1,
      appsOverHundredThousandRatings: 1,
    });
    expect(done.previous).toBeNull();
    expect(done.failure).toBeNull();
  });

  it('compares a run with the previous completed run of the keyword', async () => {
    const first = await inspect({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
    });
    await runJob(first.id);
    registry.results = [
      SEARCH[0],
      { storeAppId: '300', title: 'Streak Builder', ratingCount: 900 },
    ];
    const second = await inspect({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
    });
    await runJob(second.id);

    const read = (
      await api.get(`/keyword-inspections/${second.id}`).expect(200)
    ).body as KeywordInspection;
    expect(read.previous).toMatchObject({
      inspectionId: first.id,
      entered: ['Streak Builder'],
      left: ['Daily Planner'],
    });
  });

  it('marks the inspection failed on the final attempt and keeps it pending before', async () => {
    registry.searchFails = true;
    const pending = await inspect({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
    });

    await expect(runJob(pending.id, { final: false })).rejects.toThrow();
    expect(
      (await api.get(`/keyword-inspections/${pending.id}`).expect(200)).body,
    ).toMatchObject({ status: 'PENDING' });

    await expect(runJob(pending.id)).rejects.toThrow();
    const failed = (
      await api.get(`/keyword-inspections/${pending.id}`).expect(200)
    ).body as KeywordInspection;
    expect(failed.status).toBe('FAILED');
    expect(failed.failure).toEqual(expect.any(String));
  });

  it('lists inspections newest first and filters by keyword and store', async () => {
    const first = await inspect({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
    });
    const second = await inspect({
      keyword: 'water reminder',
      store: 'GOOGLE_PLAY',
      country: 'de',
    });

    const all = (await api.get('/keyword-inspections').expect(200))
      .body as KeywordInspectionList;
    expect(all.items.map((item) => item.id)).toEqual([second.id, first.id]);

    const filtered = (
      await api
        .get('/keyword-inspections')
        .query({ keyword: 'Habit Tracker', store: 'APP_STORE' })
        .expect(200)
    ).body as KeywordInspectionList;
    expect(filtered.items.map((item) => item.id)).toEqual([first.id]);
  });

  it('refuses an invalid request without spending or storing anything', async () => {
    for (const body of [
      { keyword: '', store: 'APP_STORE', country: 'us' },
      { keyword: 'habit', store: 'NOPE', country: 'us' },
      { keyword: 'habit', store: 'APP_STORE', country: 'USA' },
      {
        keyword: 'one two three four five six',
        store: 'APP_STORE',
        country: 'us',
      },
    ]) {
      const response = await api
        .post('/keyword-inspections')
        .send(body)
        .expect(400);
      expect((response.body as ApiErrorEnvelope).statusCode).toBe(400);
    }
    expect(await prisma.keywordInspection.count()).toBe(0);
  });

  it('deletes an inspection and answers 404 for an unknown one', async () => {
    const pending = await inspect({
      keyword: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
    });

    await api.delete(`/keyword-inspections/${pending.id}`).expect(204);
    await api.get(`/keyword-inspections/${pending.id}`).expect(404);
    await api.delete(`/keyword-inspections/${pending.id}`).expect(404);
  });
});
