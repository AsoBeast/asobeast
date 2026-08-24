import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ACTION_FORMULA_VERSION,
  ActionItem,
  ActionListResult,
  ActionRunResult,
  ActionSummary,
  KeywordAddUncoveredEvidence,
} from '@asobeast/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { QUEUES } from '../src/jobs/jobs.types';
import { obliterateQueues } from './obliterate-queues';
import { ownerAgent, useCookies } from './helpers/session';

const DAY_MS = 86_400_000;

const EVIDENCE: KeywordAddUncoveredEvidence = {
  rule: 'keyword.add_uncovered',
  opportunity: 66.5,
  traffic: 6.2,
  difficulty: 4.1,
  volume: 62,
  relevance: 80,
  latestPosition: null,
  indexedFields: ['title'],
  uncoveredFields: ['title'],
  keywordFieldCharsFree: 18,
  scoreProvenance: null,
};

describe('ActionsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let appId: string;
  let keywordId: string;

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
      .useValue({
        get: () => {
          throw new Error('this suite must never touch a store');
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1234567890',
        country: 'us',
        name: 'Habit Tracker',
      },
    });
    appId = created.id;
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    keywordId = keyword.id;
  });

  const seedAction = async (
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const now = new Date();
    const row = await prisma.actionItem.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId,
        keywordId,
        rule: 'keyword.add_uncovered',
        category: 'metadata',
        store: Store.APP_STORE,
        country: 'us',
        fingerprint: `fp_${Math.random().toString(36).slice(2)}`,
        status: 'OPEN',
        priority: 'high',
        impact: 71,
        formulaVersion: ACTION_FORMULA_VERSION,
        evidence: EVIDENCE,
        firstSeenAt: now,
        lastSeenAt: now,
        ...overrides,
      },
    });
    return row.id;
  };

  const future = (days: number): string =>
    new Date(Date.now() + days * DAY_MS).toISOString();

  it('lists open and snoozed actions sorted by impact', async () => {
    await seedAction({ impact: 40, priority: 'medium' });
    await seedAction({ impact: 90, priority: 'critical' });
    await seedAction({ impact: 95, status: 'DONE', priority: 'critical' });

    const res = await api.get('/actions').expect(200);
    const body = res.body as ActionListResult;

    expect(body.items.map((item) => item.impact)).toEqual([90, 40]);
    expect(body.total).toBe(2);
    expect(body.generatedAt).not.toBeNull();
    expect(body.items[0].scope).toMatchObject({
      appId,
      appName: 'Habit Tracker',
      keywordId,
      keywordText: 'habit tracker',
    });
  });

  it('narrows by priority, rule and status', async () => {
    await seedAction({ priority: 'low', impact: 10 });
    await seedAction({ priority: 'critical', impact: 90 });

    const filtered = await api
      .get('/actions')
      .query({ priority: 'critical' })
      .expect(200);
    expect((filtered.body as ActionListResult).items).toHaveLength(1);

    const byRule = await api
      .get('/actions')
      .query({ rule: 'keyword.defend' })
      .expect(200);
    expect((byRule.body as ActionListResult).items).toHaveLength(0);
  });

  it('rejects an unknown filter value and an unknown parameter', async () => {
    await api.get('/actions').query({ priority: 'urgent' }).expect(400);
    await api.get('/actions').query({ mystery: 'yes' }).expect(400);
    await api.get('/actions').query({ limit: 0 }).expect(400);
    await api.get('/actions').query({ limit: 201 }).expect(400);
  });

  it('scopes the app route and reports an empty list for another app', async () => {
    await seedAction();
    const other = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '999',
        country: 'us',
        name: 'Other',
      },
    });

    const mine = await api.get(`/apps/${appId}/actions`).expect(200);
    const theirs = await api.get(`/apps/${other.id}/actions`).expect(200);

    expect((mine.body as ActionListResult).items).toHaveLength(1);
    expect((theirs.body as ActionListResult).items).toHaveLength(0);
  });

  it('summarizes the queue', async () => {
    await seedAction({ priority: 'critical', impact: 90 });
    await seedAction({ priority: 'high', status: 'SNOOZED' });

    const res = await api.get('/actions/summary').expect(200);
    const summary = res.body as ActionSummary;

    expect(summary).toMatchObject({
      open: 1,
      snoozed: 1,
      byPriority: { critical: 1, high: 1, medium: 0, low: 0 },
    });
    expect(summary.byCategory.metadata).toBe(2);
    expect(summary.topRules).toEqual([
      { rule: 'keyword.add_uncovered', count: 2 },
    ]);
    expect(summary.suppressedByCap).toBe(0);
  });

  it('marks an action done and clears its snooze', async () => {
    const id = await seedAction();

    const res = await api
      .patch(`/actions/${id}`)
      .send({ status: 'DONE', note: 'shipped' })
      .expect(200);
    const item = res.body as ActionItem;

    expect(item).toMatchObject({ status: 'DONE', note: 'shipped' });
    expect(item.closedAt).not.toBeNull();
    expect(item.snoozedUntil).toBeNull();
  });

  it('snoozes with a wake date and rejects invalid snoozes', async () => {
    const id = await seedAction();

    const ok = await api
      .patch(`/actions/${id}`)
      .send({ status: 'SNOOZED', snoozedUntil: future(7) })
      .expect(200);
    expect((ok.body as ActionItem).snoozedUntil).not.toBeNull();

    await api
      .patch(`/actions/${id}`)
      .send({ status: 'SNOOZED', snoozedUntil: future(-1) })
      .expect(400);
    await api.patch(`/actions/${id}`).send({ status: 'SNOOZED' }).expect(400);
    await api
      .patch(`/actions/${id}`)
      .send({ status: 'SNOOZED', snoozedUntil: future(120) })
      .expect(400);
    await api
      .patch(`/actions/${id}`)
      .send({ status: 'DONE', snoozedUntil: future(7) })
      .expect(400);
  });

  it('refuses to close a resolved action', async () => {
    const id = await seedAction({ status: 'RESOLVED', resolvedAt: new Date() });

    await api.patch(`/actions/${id}`).send({ status: 'DONE' }).expect(409);
    await api.patch(`/actions/${id}`).send({ status: 'DISMISSED' }).expect(409);
  });

  it('reopens from done and from dismissed, counting each reopen', async () => {
    for (const status of ['DONE', 'DISMISSED']) {
      const id = await seedAction({ status, closedAt: new Date() });

      const res = await api
        .patch(`/actions/${id}`)
        .send({ status: 'OPEN' })
        .expect(200);

      expect(res.body as ActionItem).toMatchObject({
        status: 'OPEN',
        reopenCount: 1,
        closedAt: null,
        resolvedAt: null,
      });
    }
  });

  it('rejects an unknown id and an invalid status', async () => {
    await api.patch('/actions/missing').send({ status: 'DONE' }).expect(404);
    const id = await seedAction();
    await api.patch(`/actions/${id}`).send({ status: 'RESOLVED' }).expect(400);
    await api.patch(`/actions/${id}`).send({}).expect(400);
  });

  it('returns a degraded row instead of failing the list', async () => {
    await seedAction({ evidence: { rule: 'wrong' } });

    const res = await api.get('/actions').expect(200);
    const body = res.body as ActionListResult;

    expect(body.items[0]).toMatchObject({ degraded: true, evidence: null });
  });

  it('queues a generation run and coalesces a same-day duplicate', async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.PIPELINE), {
      strict: false,
    });
    await queue.pause();
    try {
      const first = await api.post('/actions/run').expect(202);
      const second = await api.post('/actions/run').expect(202);

      expect((first.body as ActionRunResult).queued).toBe(true);
      expect((second.body as ActionRunResult).jobId).toBe(
        (first.body as ActionRunResult).jobId,
      );
    } finally {
      await queue.obliterate({ force: true });
      await queue.resume();
    }
  });

  it('reports the AI seam as unconfigured and refuses to explain', async () => {
    const id = await seedAction();

    const status = await api.get('/actions/ai-status').expect(200);
    expect(status.body).toEqual({ configured: false, model: null });

    await api.post(`/actions/${id}/explain`).expect(409);
  });
});
