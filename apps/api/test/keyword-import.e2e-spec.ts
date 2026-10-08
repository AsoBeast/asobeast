import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  KEYWORD_IMPORT_LIMIT,
  KeywordImportResult,
  KeywordImportRow,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  title: 'Habit Tracker',
  subtitle: 'Daily streak counter',
  summary: 'A markdown journal',
  description: 'Fixture description',
  raw: { source: 'fixture' },
  searchable: true,
};

const APP_STORE_URL = 'https://apps.apple.com/us/app/fixture/id1234567890';

class FakeRegistry {
  get(store: Store): StoreProvider {
    return {
      store,
      getApp: () => Promise.resolve(FIXTURE),
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
    } as unknown as StoreProvider;
  }
}

describe('Keyword import (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const importApp = async (): Promise<string> =>
    (
      (await api.post('/apps').send({ url: APP_STORE_URL }).expect(201))
        .body as AppDetail
    ).id;

  const preview = async (
    id: string,
    rows: KeywordImportRow[],
    country?: string,
  ) =>
    (
      await api
        .post(`/apps/${id}/keywords/import/preview`)
        .send({ rows, country })
        .expect(200)
    ).body as KeywordImportResult;

  const commit = async (
    id: string,
    rows: KeywordImportRow[],
    country?: string,
  ) =>
    (
      await api
        .post(`/apps/${id}/keywords/import`)
        .send({ rows, country })
        .expect(200)
    ).body as KeywordImportResult;

  const appStoreQueue = () =>
    app.get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false });

  const queuedJobs = async (): Promise<number> => {
    const counts = await appStoreQueue().getJobCounts(
      'waiting',
      'paused',
      'delayed',
    );
    return Object.values(counts).reduce((total, count) => total + count, 0);
  };

  const queuedScores = async (): Promise<number> =>
    (await appStoreQueue().getJobs(['waiting', 'paused', 'delayed'])).filter(
      (job) => job.name === JOBS.SCORE_KEYWORD,
    ).length;

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
      .useValue(new FakeRegistry())
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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('E-IMP-01 writes nothing and queues nothing', async () => {
    const id = await importApp();
    const keywords = await prisma.keyword.count();
    const tracked = await prisma.trackedKeyword.count();
    const jobs = await queuedJobs();

    const result = await preview(id, [
      { keyword: 'habit builder' },
      { keyword: 'streak counter', country: 'pl' },
    ]);

    expect(result).toMatchObject({ dryRun: true, imported: 0 });
    expect(await prisma.keyword.count()).toBe(keywords);
    expect(await prisma.trackedKeyword.count()).toBe(tracked);
    expect(await queuedJobs()).toBe(jobs);
  });

  it('E-IMP-02 answers every row with its status, reason and market', async () => {
    const id = await importApp();

    const result = await preview(id, [
      { keyword: 'Habit Builder', country: 'US', tags: ['Core'], note: 'Q4' },
      { keyword: 'habit-builder' },
      { keyword: 'b'.repeat(101) },
      { keyword: 'tower', country: 'zz' },
      { keyword: 'one two three four five six' },
      { keyword: 'sleep notes', tags: ['#bad'] },
      { keyword: 'aplikacja treningowa', country: 'pl' },
    ]);

    expect(
      result.results.map((row) => [
        row.index,
        row.status,
        row.reason ?? null,
        row.country,
      ]),
    ).toEqual([
      [0, 'new', null, 'us'],
      [1, 'duplicate', null, 'us'],
      [2, 'invalid', 'tooLong', 'us'],
      [3, 'invalid', 'unknownCountry', 'zz'],
      [4, 'invalid', 'tooManyWords', 'us'],
      [5, 'invalid', 'invalidTag', 'us'],
      [6, 'new', null, 'pl'],
    ]);
    expect(result.results[1].duplicateOf).toBe(0);
    expect(result.summary).toEqual({
      rows: 7,
      new: 2,
      resume: 0,
      tracked: 0,
      duplicate: 1,
      invalid: 4,
      overQuota: 0,
    });
    expect(result.cost).toEqual({
      store: 'APP_STORE',
      keywordMarkets: 2,
      dailyRequests: 3,
    });
  });

  it('E-IMP-03 skips a phrase the app already tracks', async () => {
    const id = await importApp();

    const result = await preview(id, [
      { keyword: 'habit' },
      { keyword: 'streak' },
    ]);

    expect(result.results.map((row) => row.status)).toEqual([
      'tracked',
      'tracked',
    ]);
    expect(result.cost.keywordMarkets).toBe(0);
  });

  it('E-IMP-04 plans a resume for a paused keyword and leaves it paused', async () => {
    const id = await importApp();
    await prisma.trackedKeyword.updateMany({
      where: { appId: id, keyword: { text: 'habit' } },
      data: { active: false },
    });

    const result = await preview(id, [{ keyword: 'habit' }]);

    expect(result.results[0].status).toBe('resume');
    expect(
      await prisma.trackedKeyword.count({
        where: { appId: id, active: false },
      }),
    ).toBe(1);
  });

  it('E-IMP-05 gives a row without a country the requested market, else the home market', async () => {
    const id = await importApp();

    const home = await preview(id, [{ keyword: 'focus timer' }]);
    const requested = await preview(
      id,
      [{ keyword: 'focus timer' }, { keyword: 'zeit', country: 'de' }],
      'pl',
    );

    expect(home.results[0].country).toBe('us');
    expect(requested.results.map((row) => row.country)).toEqual(['pl', 'de']);
  });

  it('E-IMP-07 reports no quota and no refusal when billing is off', async () => {
    const id = await importApp();

    const result = await preview(id, [{ keyword: 'focus timer' }]);

    expect(result.quota).toBeNull();
    expect(result.summary.overQuota).toBe(0);
  });

  it('E-IMP-08 refuses an import of more rows than one request may carry', async () => {
    const id = await importApp();
    const rows = Array.from(
      { length: KEYWORD_IMPORT_LIMIT + 1 },
      (_, index) => ({ keyword: `kw${index}` }),
    );

    await api
      .post(`/apps/${id}/keywords/import/preview`)
      .send({ rows })
      .expect(400);
  });

  it('E-IMP-09 accepts the largest import of realistic rows inside the body limit', async () => {
    const id = await importApp();
    const rows = Array.from({ length: KEYWORD_IMPORT_LIMIT }, (_, index) => ({
      keyword: `fitness workout plan ${index}`,
      country: 'us',
      tags: ['core', 'campaign q4'],
      note: 'Imported from the shared research sheet',
    }));
    expect(
      Buffer.byteLength(JSON.stringify({ rows, country: 'us' })),
    ).toBeLessThan(102_400);

    const result = await preview(id, rows, 'us');

    expect(result.summary).toMatchObject({
      rows: KEYWORD_IMPORT_LIMIT,
      new: KEYWORD_IMPORT_LIMIT,
    });
  });

  it('E-IMP-13 lets a read only token preview', async () => {
    const id = await importApp();
    const token = await seedApiToken(prisma, {
      seed: 'importreader',
      email: 'reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });

    const response = await request(app.getHttpServer())
      .post(`/apps/${id}/keywords/import/preview`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [{ keyword: 'focus timer' }] })
      .expect(200);

    expect((response.body as KeywordImportResult).summary.new).toBe(1);
  });

  it.each(['zz', 'USA', ''])(
    'E-IMP-17 refuses the default market %j for the whole request',
    async (country) => {
      const id = await importApp();

      await api
        .post(`/apps/${id}/keywords/import/preview`)
        .send({ rows: [{ keyword: 'focus timer' }], country })
        .expect(400);
    },
  );

  it('E-IMP-18 judges countries by the Play list and prices a Play market at eight requests', async () => {
    const play = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.game',
        country: 'us',
        name: 'Idle Tower Defense',
      },
    });

    const result = await preview(play.id, [
      { keyword: 'tower defense' },
      { keyword: 'tower', country: 'pw' },
    ]);

    expect(result.results[1]).toMatchObject({
      status: 'invalid',
      reason: 'unknownCountry',
      message: 'pw is not a Google Play location',
    });
    expect(result.cost).toEqual({
      store: 'GOOGLE_PLAY',
      keywordMarkets: 1,
      dailyRequests: 8,
    });
  });

  it('E-IMP-19 refuses a NUL character anywhere in the rows', async () => {
    const id = await importApp();

    const response = await api
      .post(`/apps/${id}/keywords/import/preview`)
      .send({ rows: [{ keyword: 'focus\u0000timer' }] })
      .expect(400);

    expect((response.body as ApiErrorEnvelope).statusCode).toBe(400);
  });

  it('E-IMP-24 answers 404 for an app that does not exist', async () => {
    await api
      .post('/apps/missing/keywords/import/preview')
      .send({ rows: [{ keyword: 'focus timer' }] })
      .expect(404);
  });

  it('E-IMP-21 tracks rows across markets with their tags and notes as manual keywords', async () => {
    const id = await importApp();

    const result = await commit(id, [
      {
        keyword: 'Habit Builder',
        country: 'us',
        tags: ['Core', 'brand'],
        note: 'Q4 push',
      },
      { keyword: 'aplikacja treningowa', country: 'pl', tags: ['core'] },
      { keyword: 'Gewohnheiten', country: 'de', note: ' ' },
      { keyword: 'bad', country: 'zz' },
    ]);

    expect(result).toMatchObject({ dryRun: false, imported: 3 });
    expect(result.summary).toMatchObject({ new: 3, invalid: 1 });
    const listed = (await api.get(`/apps/${id}/keywords`).expect(200))
      .body as TrackedKeywordItem[];
    const byText = (text: string) => listed.find((item) => item.text === text);
    expect(byText('habit builder')).toMatchObject({
      country: 'us',
      source: 'MANUAL',
      active: true,
      tags: ['core', 'brand'],
      note: 'Q4 push',
    });
    expect(byText('aplikacja treningowa')).toMatchObject({
      country: 'pl',
      tags: ['core'],
      note: null,
    });
    expect(byText('gewohnheiten')).toMatchObject({
      country: 'de',
      tags: [],
      note: null,
    });
    expect(byText('bad')).toBeUndefined();
    const countries = (
      await api.get(`/apps/${id}/keyword-countries`).expect(200)
    ).body as { country: string; keywordCount: number }[];
    expect(
      countries
        .filter((row) => row.country !== 'us')
        .map((row) => row.country)
        .sort(),
    ).toEqual(['de', 'pl']);
  });

  it('E-IMP-10 tracks nothing the second time the same file is imported', async () => {
    const id = await importApp();
    const rows = [
      { keyword: 'habit builder' },
      { keyword: 'focus timer', country: 'pl' },
    ];
    await commit(id, rows);
    const tracked = await prisma.trackedKeyword.count();

    const again = await commit(id, rows);

    expect(again.imported).toBe(0);
    expect(again.results.map((row) => row.status)).toEqual([
      'tracked',
      'tracked',
    ]);
    expect(await prisma.trackedKeyword.count()).toBe(tracked);
  });

  it('E-IMP-11 tracks a phrase another app of the workspace already tracks without a new keyword row', async () => {
    const id = await importApp();
    const other = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '999',
        country: 'us',
        name: 'Other',
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'shared phrase', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: { appId: other.id, keywordId: keyword.id, source: 'MANUAL' },
    });
    const keywords = await prisma.keyword.count();

    const result = await commit(id, [
      { keyword: 'Shared Phrase', tags: ['core'] },
    ]);

    expect(result).toMatchObject({
      imported: 1,
      cost: { keywordMarkets: 0, dailyRequests: 0 },
    });
    expect(await prisma.keyword.count()).toBe(keywords);
    expect(
      await prisma.trackedKeyword.count({
        where: { appId: id, keywordId: keyword.id },
      }),
    ).toBe(1);
  });

  it('E-IMP-12 resumes a paused keyword and keeps its tags and note', async () => {
    const id = await importApp();
    await prisma.trackedKeyword.updateMany({
      where: { appId: id, keyword: { text: 'habit' } },
      data: { active: false, tags: ['keep'], note: 'old' },
    });

    const result = await commit(id, [
      { keyword: 'habit', tags: ['new'], note: 'ignored' },
    ]);

    expect(result).toMatchObject({
      imported: 1,
      results: [{ status: 'resume' }],
    });
    const row = await prisma.trackedKeyword.findFirstOrThrow({
      where: { appId: id, keyword: { text: 'habit' } },
    });
    expect(row).toMatchObject({ active: true, tags: ['keep'], note: 'old' });
  });

  it('E-IMP-15 refuses the import for a read only token and writes nothing', async () => {
    const id = await importApp();
    const token = await seedApiToken(prisma, {
      seed: 'importreader2',
      email: 'reader2@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'read',
    });
    const tracked = await prisma.trackedKeyword.count();

    await request(app.getHttpServer())
      .post(`/apps/${id}/keywords/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [{ keyword: 'focus timer' }] })
      .expect(403);

    expect(await prisma.trackedKeyword.count()).toBe(tracked);
  });

  it('E-IMP-22 queues one first score per new keyword and none for a skipped row', async () => {
    const id = await importApp();
    const scores = await queuedScores();

    await commit(id, [
      { keyword: 'habit' },
      { keyword: 'focus timer' },
      { keyword: 'sleep notes', country: 'pl' },
      { keyword: '' },
    ]);

    expect(await queuedScores()).toBe(scores + 2);
  });

  it('E-IMP-23 imports the largest request of realistic rows', async () => {
    const id = await importApp();
    const rows = Array.from({ length: KEYWORD_IMPORT_LIMIT }, (_, index) => ({
      keyword: `fitness workout plan ${index}`,
      tags: ['core', 'campaign q4'],
      note: 'Imported from the shared research sheet',
    }));

    const result = await commit(id, rows);

    expect(result.imported).toBe(KEYWORD_IMPORT_LIMIT);
    expect(
      await prisma.trackedKeyword.count({
        where: {
          appId: id,
          keyword: { text: { startsWith: 'fitness workout plan' } },
        },
      }),
    ).toBe(KEYWORD_IMPORT_LIMIT);
  });
});
