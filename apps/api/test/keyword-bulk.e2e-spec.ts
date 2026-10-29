import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { KeywordSource, PrismaClient, Store } from '@prisma/client';
import {
  KEYWORD_BULK_CHANGE_LIMIT,
  KeywordBulkRequest,
  KeywordBulkResult,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  firstRunCheckJobId,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../src/jobs/jobs.types';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('KeywordsController bulk change (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

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

  const seedApp = (storeAppId = '111') =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: 'Focus Timer',
      },
    });

  const track = async (
    appId: string,
    text: string,
    options: { active?: boolean; source?: KeywordSource } = {},
  ) => {
    const keyword = await prisma.keyword.upsert({
      where: {
        text_store_country: { text, store: Store.APP_STORE, country: 'us' },
      },
      update: {},
      create: { text, store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId,
        keywordId: keyword.id,
        source: options.source ?? 'MANUAL',
        active: options.active ?? true,
      },
    });
    return keyword.id;
  };

  const bulk = (appId: string, body: KeywordBulkRequest, status = 200) =>
    api.post(`/apps/${appId}/keywords/bulk`).send(body).expect(status);

  const resultOf = async (appId: string, body: KeywordBulkRequest) =>
    (await bulk(appId, body)).body as KeywordBulkResult;

  const listed = async (appId: string): Promise<TrackedKeywordItem[]> =>
    (await api.get(`/apps/${appId}/keywords`).expect(200))
      .body as TrackedKeywordItem[];

  const checkedJobIds = async (): Promise<string[]> => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.APP_STORE), {
      strict: false,
    });
    const jobs = await queue.getJobs([
      'wait',
      'paused',
      'delayed',
      'prioritized',
    ]);
    return jobs
      .filter((job) => job.name === JOBS.CHECK_KEYWORD)
      .map((job) => job.id ?? '');
  };

  it('pauses the selected rows only', async () => {
    const primary = await seedApp();
    const one = await track(primary.id, 'one');
    const two = await track(primary.id, 'two');
    await track(primary.id, 'three');

    const result = await resultOf(primary.id, {
      action: 'pause',
      keywordIds: [one, two],
    });

    expect(result.changed).toBe(2);
    const active = new Map(
      (await listed(primary.id)).map((item) => [item.text, item.active]),
    );
    expect(active).toEqual(
      new Map([
        ['one', false],
        ['two', false],
        ['three', true],
      ]),
    );
  });

  it('reports the rows that were already paused', async () => {
    const primary = await seedApp();
    const paused = await track(primary.id, 'paused', { active: false });
    const active = await track(primary.id, 'active');

    const result = await resultOf(primary.id, {
      action: 'pause',
      keywordIds: [paused, active],
    });

    expect(result).toMatchObject({ changed: 1, unchanged: 1 });
  });

  it('resumes a paused keyword and queues its first check', async () => {
    const primary = await seedApp();
    const keywordId = await track(primary.id, 'paused', { active: false });

    const result = await resultOf(primary.id, {
      action: 'resume',
      keywordIds: [keywordId],
    });

    expect(result.changed).toBe(1);
    expect(await checkedJobIds()).toEqual([
      firstRunCheckJobId(primary.id, keywordId, utcDateKey()),
    ]);
  });

  it.each(['pause', 'untrack'] as const)(
    'queues no first check for %s',
    async (action) => {
      const primary = await seedApp();
      const keywordId = await track(primary.id, 'active');

      await bulk(primary.id, { action, keywordIds: [keywordId] });

      expect(await checkedJobIds()).toEqual([]);
    },
  );

  it('queues no first check when resuming an active keyword', async () => {
    const primary = await seedApp();
    const keywordId = await track(primary.id, 'active');

    const result = await resultOf(primary.id, {
      action: 'resume',
      keywordIds: [keywordId],
    });

    expect(result).toMatchObject({ changed: 0, unchanged: 1 });
    expect(await checkedJobIds()).toEqual([]);
  });

  it('counts a repeated id once', async () => {
    const primary = await seedApp();
    const keywordId = await track(primary.id, 'twice');

    const result = await resultOf(primary.id, {
      action: 'pause',
      keywordIds: [keywordId, keywordId, 'gone', 'gone'],
    });

    expect(result).toEqual({
      action: 'pause',
      requested: 2,
      changed: 1,
      unchanged: 0,
      missing: ['gone'],
    });
  });

  it('moves a resumed keyword field row to manual', async () => {
    const primary = await seedApp();
    const keywordId = await track(primary.id, 'field phrase', {
      active: false,
      source: 'KEYWORD_FIELD',
    });

    await bulk(primary.id, { action: 'resume', keywordIds: [keywordId] });

    const row = await prisma.trackedKeyword.findUniqueOrThrow({
      where: { appId_keywordId: { appId: primary.id, keywordId } },
    });
    expect(row).toMatchObject({ active: true, source: 'MANUAL' });
  });

  it('untracks and keeps the keyword rows and the keyword field', async () => {
    const primary = await seedApp();
    const one = await track(primary.id, 'one');
    const two = await track(primary.id, 'two');
    await prisma.keywordField.create({
      data: {
        appId: primary.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        localization: 'en-US',
        phrases: ['one', 'two'],
      },
    });

    const result = await resultOf(primary.id, {
      action: 'untrack',
      keywordIds: [one, two],
    });

    expect(result.changed).toBe(2);
    expect(
      await prisma.trackedKeyword.count({ where: { appId: primary.id } }),
    ).toBe(0);
    expect(
      await prisma.keyword.count({ where: { id: { in: [one, two] } } }),
    ).toBe(2);
    expect(
      (
        await prisma.keywordField.findFirstOrThrow({
          where: { appId: primary.id },
        })
      ).phrases,
    ).toEqual(['one', 'two']);
  });

  it('reports an id the app no longer tracks', async () => {
    const primary = await seedApp();
    const tracked = await track(primary.id, 'tracked');

    const result = await resultOf(primary.id, {
      action: 'untrack',
      keywordIds: [tracked, 'gone'],
    });

    expect(result).toMatchObject({ changed: 1, missing: ['gone'] });
  });

  it('never touches a keyword another app tracks', async () => {
    const primary = await seedApp();
    const other = await seedApp('222');
    const theirs = await track(other.id, 'theirs');

    const result = await resultOf(primary.id, {
      action: 'pause',
      keywordIds: [theirs],
    });

    expect(result).toMatchObject({ changed: 0, missing: [theirs] });
    expect(
      await prisma.trackedKeyword.findUniqueOrThrow({
        where: { appId_keywordId: { appId: other.id, keywordId: theirs } },
      }),
    ).toMatchObject({ active: true });
  });

  it.each([
    ['an empty list', { action: 'pause', keywordIds: [] }],
    [
      'one id over the limit',
      {
        action: 'pause',
        keywordIds: Array.from(
          { length: KEYWORD_BULK_CHANGE_LIMIT + 1 },
          (_, index) => `kw-${index}`,
        ),
      },
    ],
    ['an unknown action', { action: 'archive', keywordIds: ['kw-1'] }],
  ])('refuses %s and writes nothing', async (_case, body) => {
    const primary = await seedApp();
    await track(primary.id, 'kept');

    await api.post(`/apps/${primary.id}/keywords/bulk`).send(body).expect(400);

    expect(
      await prisma.trackedKeyword.count({
        where: { appId: primary.id, active: true },
      }),
    ).toBe(1);
  });

  it('answers 404 for an unknown app', async () => {
    await bulk('missing-app', { action: 'pause', keywordIds: ['kw-1'] }, 404);
  });

  it('leaves the single toggle and removal working after a bulk change', async () => {
    const primary = await seedApp();
    const one = await track(primary.id, 'one');
    const two = await track(primary.id, 'two');

    await bulk(primary.id, { action: 'pause', keywordIds: [one, two] });

    await api
      .patch(`/apps/${primary.id}/keywords/${one}`)
      .send({ active: true })
      .expect(200);
    await api.delete(`/apps/${primary.id}/keywords/${two}`).expect(204);
  });

  it('answers the counts and not the keyword list', async () => {
    const primary = await seedApp();
    const one = await track(primary.id, 'one');

    const result = await resultOf(primary.id, {
      action: 'pause',
      keywordIds: [one],
    });

    expect(Object.keys(result).sort()).toEqual([
      'action',
      'changed',
      'missing',
      'requested',
      'unchanged',
    ]);
  });
});
