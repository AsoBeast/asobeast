import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ACTION_FORMULA_VERSION,
  ActionActivity,
  ActionBulkUpdateResult,
  ActionItem,
  ApiErrorEnvelope,
  ActionListResult,
  ActionRunResult,
  ActionSummary,
  AuditFixFactorEvidence,
  KeywordAddUncoveredEvidence,
} from '@asobeast/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { QUEUES } from '../src/jobs/jobs.types';
import { obliterateQueues } from './obliterate-queues';
import { ownerAgent, useCookies } from './helpers/session';

const DAY_MS = 86_400_000;
const FOREIGN_WORKSPACE_ID = 'ws_foreign_actions';

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

async function waitForCompletion(queue: Queue, jobId: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await (await queue.getJob(jobId))?.getState()) === 'completed') return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Job ${jobId} did not complete within 10 seconds`);
}

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
    await prisma.workspace.deleteMany({ where: { id: FOREIGN_WORKSPACE_ID } });
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

  it('answers 404 for an app id that does not exist, like its siblings', async () => {
    const actions = await api
      .get('/apps/totally-made-up-id/actions')
      .expect(404);
    const keywords = await api
      .get('/apps/totally-made-up-id/keywords')
      .expect(404);

    expect((actions.body as ApiErrorEnvelope).message).toBe(
      'App totally-made-up-id not found',
    );
    expect((keywords.body as ApiErrorEnvelope).message).toBe(
      'App totally-made-up-id not found',
    );
  });

  it('answers the same 404 for an app in another workspace', async () => {
    await prisma.workspace.upsert({
      where: { id: FOREIGN_WORKSPACE_ID },
      update: {},
      create: { id: FOREIGN_WORKSPACE_ID, name: 'Foreign' },
    });
    const foreign = await prisma.app.create({
      data: {
        workspaceId: FOREIGN_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '555',
        country: 'us',
        name: 'Foreign',
      },
    });

    const res = await api.get(`/apps/${foreign.id}/actions`).expect(404);

    expect((res.body as ApiErrorEnvelope).message).toBe(
      `App ${foreign.id} not found`,
    );
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
    expect(summary.openByPriority).toEqual({
      critical: 1,
      high: 0,
      medium: 0,
      low: 0,
    });
    expect(summary.byStatus).toEqual({
      OPEN: 1,
      SNOOZED: 1,
      DONE: 0,
      DISMISSED: 0,
      RESOLVED: 0,
    });
  });

  it('scopes the summary to one app and still ignores unknown parameters', async () => {
    await seedAction({ priority: 'critical' });
    const other = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '999',
        country: 'us',
        name: 'Other',
      },
    });
    await seedAction({ appId: other.id, priority: 'high' });

    const scoped = await api
      .get('/actions/summary')
      .query({ appId, anything: '1' })
      .expect(200);
    const summary = scoped.body as ActionSummary;

    expect(summary.open).toBe(1);
    expect(summary.openByPriority).toMatchObject({ critical: 1, high: 0 });
    await api.get('/actions/summary?anything=1').expect(200);
    await api.get('/actions/summary?store=NOPE').expect(400);
  });

  it('keeps the literal routes ahead of the action id route', async () => {
    const summary = await api.get('/actions/summary').expect(200);
    const aiStatus = await api.get('/actions/ai-status').expect(200);

    expect(summary.body).toHaveProperty('byStatus');
    expect(aiStatus.body).toHaveProperty('configured');
  });

  it('reports today in the daily activity and scopes it to one app', async () => {
    const opened = await seedAction();
    const done = await seedAction();
    const dismissed = await seedAction();
    await prisma.actionEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        actionId: opened,
        appId,
        type: 'opened',
        actor: 'system',
        status: 'OPEN',
        priority: 'high',
        impact: 71,
      },
    });
    await api.patch(`/actions/${done}`).send({ status: 'DONE' }).expect(200);
    await api
      .patch(`/actions/${dismissed}`)
      .send({ status: 'DISMISSED' })
      .expect(200);

    const activity = (await api.get('/actions/activity?days=7').expect(200))
      .body as ActionActivity;
    const other = (
      await api
        .get('/actions/activity')
        .query({ appId: 'app_elsewhere' })
        .expect(200)
    ).body as ActionActivity;

    expect(activity.days).toHaveLength(7);
    expect(activity.days.at(-1)).toMatchObject({
      opened: 1,
      done: 1,
      dismissed: 1,
    });
    expect(other.days).toHaveLength(30);
    expect(Object.values(other.totals).every((count) => count === 0)).toBe(
      true,
    );
    await api.get('/actions/activity?days=6').expect(400);
    await api.get('/actions/activity?days=91').expect(400);
  });

  it('closes many actions in one request', async () => {
    const ids = [await seedAction(), await seedAction(), await seedAction()];

    const res = await api
      .patch('/actions')
      .send({ ids, status: 'DONE' })
      .expect(200);
    const body = res.body as ActionBulkUpdateResult;

    expect(body.items.map((item) => item.id)).toEqual(ids);
    expect(body.items.every((item) => item.status === 'DONE')).toBe(true);
    expect(body.items.every((item) => item.closedAt !== null)).toBe(true);
    expect(body).toMatchObject({ missing: [], conflicts: [] });
  });

  it('refuses an invalid bulk request as a whole', async () => {
    const id = await seedAction();

    await api
      .patch('/actions')
      .send({ ids: [id], status: 'SNOOZED' })
      .expect(400);
    await api
      .patch('/actions')
      .send({
        ids: Array.from({ length: 101 }, (_, index) => `act_${index}`),
        status: 'DONE',
      })
      .expect(400);
    await api
      .patch('/actions')
      .send({ ids: [id, id], status: 'DONE' })
      .expect(400);
    await api.patch('/actions').send({ ids: [], status: 'DONE' }).expect(400);

    const unchanged = await prisma.actionItem.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    expect(unchanged.status).toBe('OPEN');
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

  it('rejects a null note and leaves the action open', async () => {
    const id = await seedAction();

    await api
      .patch(`/actions/${id}`)
      .send({ status: 'DONE', note: null })
      .expect(400);

    const stored = await prisma.actionItem.findUniqueOrThrow({
      where: { id },
    });
    expect(stored.status).toBe('OPEN');
    expect(stored.note).toBeNull();
  });

  it('keeps the stored note when the update omits it', async () => {
    const id = await seedAction({ note: 'waiting on design' });

    const res = await api
      .patch(`/actions/${id}`)
      .send({ status: 'DONE' })
      .expect(200);

    expect(res.body as ActionItem).toMatchObject({
      status: 'DONE',
      note: 'waiting on design',
    });
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

  it('records why an action was dismissed', async () => {
    const id = await seedAction();

    await api
      .patch(`/actions/${id}`)
      .send({ status: 'DISMISSED', reason: 'not_relevant' })
      .expect(200);

    const events = await prisma.actionEvent.findMany({
      where: { actionId: id },
      select: { type: true, reason: true },
    });
    expect(events).toEqual([{ type: 'dismissed', reason: 'not_relevant' }]);
  });

  it('records a reason given to an action that is already dismissed', async () => {
    const id = await seedAction();
    await api.patch(`/actions/${id}`).send({ status: 'DISMISSED' }).expect(200);

    await api
      .patch(`/actions/${id}`)
      .send({ status: 'DISMISSED', reason: 'handled_elsewhere' })
      .expect(200);

    const events = await prisma.actionEvent.findMany({
      where: { actionId: id },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: { type: true, reason: true },
    });
    expect(events).toEqual([
      { type: 'dismissed', reason: null },
      { type: 'dismissed', reason: 'handled_elsewhere' },
    ]);
  });

  it('rejects a reason on any status but dismissed, and an unknown reason', async () => {
    const id = await seedAction();

    const done = await api
      .patch(`/actions/${id}`)
      .send({ status: 'DONE', reason: 'not_relevant' })
      .expect(400);
    expect((done.body as ApiErrorEnvelope).message).toBe(
      'reason is only valid when status is DISMISSED',
    );
    await api
      .patch(`/actions/${id}`)
      .send({ status: 'DISMISSED', reason: 'bored' })
      .expect(400);
  });

  it('undoes a done without counting a reopen or keeping its event', async () => {
    const id = await seedAction();
    await prisma.actionEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        actionId: id,
        appId,
        type: 'opened',
        actor: 'system',
        status: 'OPEN',
        priority: 'high',
        impact: 71,
      },
    });

    await api.patch(`/actions/${id}`).send({ status: 'DONE' }).expect(200);
    const res = await api
      .patch(`/actions/${id}`)
      .send({ status: 'OPEN', revert: true })
      .expect(200);

    expect(res.body as ActionItem).toMatchObject({
      status: 'OPEN',
      reopenCount: 0,
      closedAt: null,
    });
    const events = await prisma.actionEvent.findMany({
      where: { actionId: id },
      select: { type: true },
    });
    expect(events).toEqual([{ type: 'opened' }]);
  });

  it('refuses to undo a change a teammate made', async () => {
    const id = await seedAction({ status: 'DONE', closedAt: new Date() });
    const teammate = await prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: `teammate-${id}@example.com`,
        passwordHash: 'x',
        role: 'member',
      },
    });
    await prisma.actionEvent.createMany({
      data: [
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          actionId: id,
          appId,
          type: 'opened',
          actor: 'system',
          status: 'OPEN',
          priority: 'high',
          impact: 71,
          occurredAt: new Date(Date.now() - 60_000),
        },
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          actionId: id,
          appId,
          userId: teammate.id,
          type: 'done',
          actor: 'user',
          status: 'DONE',
          priority: 'high',
          impact: 71,
        },
      ],
    });

    await api
      .patch(`/actions/${id}`)
      .send({ status: 'OPEN', revert: true })
      .expect(409);
    const row = await prisma.actionItem.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    expect(row.status).toBe('DONE');
  });

  const systemEvent = (
    id: string,
    type: string,
    status: string,
    occurredAt: Date,
    snoozedUntil: Date | null = null,
  ) => ({
    workspaceId: DEFAULT_WORKSPACE_ID,
    actionId: id,
    appId,
    type,
    actor: 'system',
    status,
    priority: 'high',
    impact: 71,
    snoozedUntil,
    occurredAt,
  });

  it('undoes a done on an action snoozed before its events were recorded', async () => {
    const snoozedUntil = new Date(future(3));
    const id = await seedAction({ status: 'SNOOZED', snoozedUntil });
    await prisma.actionEvent.create({
      data: systemEvent(id, 'opened', 'OPEN', new Date(Date.now() - DAY_MS)),
    });
    await prisma.$executeRawUnsafe(
      migrationSql('backfill_snoozed_action_events'),
    );

    await api.patch(`/actions/${id}`).send({ status: 'DONE' }).expect(200);
    const res = await api
      .patch(`/actions/${id}`)
      .send({
        status: 'SNOOZED',
        snoozedUntil: snoozedUntil.toISOString(),
        revert: true,
      })
      .expect(200);

    expect(res.body as ActionItem).toMatchObject({
      status: 'SNOOZED',
      snoozedUntil: snoozedUntil.toISOString(),
      closedAt: null,
    });
  });

  it('undoes a done on a snooze whose wake date has passed', async () => {
    const snoozedUntil = new Date(Date.now() - 60 * 60_000);
    const id = await seedAction({ status: 'SNOOZED', snoozedUntil });
    await prisma.actionEvent.createMany({
      data: [
        systemEvent(id, 'opened', 'OPEN', new Date(Date.now() - 3 * DAY_MS)),
        systemEvent(
          id,
          'snoozed',
          'SNOOZED',
          new Date(Date.now() - 2 * DAY_MS),
          snoozedUntil,
        ),
      ],
    });

    await api.patch(`/actions/${id}`).send({ status: 'DONE' }).expect(200);
    const res = await api
      .patch(`/actions/${id}`)
      .send({
        status: 'SNOOZED',
        snoozedUntil: snoozedUntil.toISOString(),
        revert: true,
      })
      .expect(200);

    expect((res.body as ActionItem).snoozedUntil).toBe(
      snoozedUntil.toISOString(),
    );
  });

  it('undoing a reopen restores the original close and its verification', async () => {
    const closedAt = new Date(Date.now() - 3 * DAY_MS);
    const verifiedAt = new Date(Date.now() - DAY_MS);
    const id = await seedAction({ status: 'DONE', closedAt, verifiedAt });
    await prisma.actionEvent.createMany({
      data: [
        systemEvent(id, 'opened', 'OPEN', new Date(Date.now() - 4 * DAY_MS)),
        systemEvent(id, 'done', 'DONE', closedAt),
        systemEvent(id, 'verified', 'DONE', verifiedAt),
      ],
    });

    await api.patch(`/actions/${id}`).send({ status: 'OPEN' }).expect(200);
    const res = await api
      .patch(`/actions/${id}`)
      .send({ status: 'DONE', revert: true })
      .expect(200);

    expect(res.body as ActionItem).toMatchObject({
      status: 'DONE',
      reopenCount: 0,
      closedAt: closedAt.toISOString(),
      verifiedAt: verifiedAt.toISOString(),
    });
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

  it('coalesces a second generation request while the first is pending', async () => {
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

  it('runs again when asked after a run has finished, and records that it ran', async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.PIPELINE), {
      strict: false,
    });
    const askedAt = Date.now();

    const first = (await api.post('/actions/run').expect(202))
      .body as ActionRunResult;
    await waitForCompletion(queue, first.jobId);

    const summary = (await api.get('/actions/summary').expect(200))
      .body as ActionSummary;
    expect(summary.open).toBe(0);
    expect(Date.parse(summary.generatedAt ?? '')).toBeGreaterThanOrEqual(
      askedAt,
    );

    const second = (await api.post('/actions/run').expect(202))
      .body as ActionRunResult;
    expect(second.jobId).not.toBe(first.jobId);
    await waitForCompletion(queue, second.jobId);
  });

  it('opens an audit action carrying the failing checks the snapshot stored', async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.PIPELINE), {
      strict: false,
    });
    const today = new Date(new Date().toISOString().slice(0, 10));
    await prisma.auditScore.create({
      data: {
        appId,
        date: today,
        overall: 52,
        coveredWeight: 90,
        totalWeight: 110,
        rubricVersion: 'v2',
        confidence: 0.82,
        factors: [
          {
            id: 'title',
            score: 3,
            weight: 20,
            confidence: 0.9,
            checks: [
              {
                id: 'title-keyword',
                label: 'Put “habit tracker” in your title',
                status: 'fail',
                score: 0,
              },
              {
                id: 'title-length',
                label: 'Title length',
                status: 'pass',
                score: 10,
              },
            ],
          },
          {
            id: 'screenshots',
            score: 2,
            weight: 15,
            confidence: 0.3,
            checks: [],
          },
        ],
      },
    });

    const run = (await api.post('/actions/run').expect(202))
      .body as ActionRunResult;
    await waitForCompletion(queue, run.jobId);

    const body = (
      await api.get('/actions').query({ rule: 'audit.fix_factor' }).expect(200)
    ).body as ActionListResult;

    expect(body.items).toHaveLength(1);
    const evidence = body.items[0].evidence as AuditFixFactorEvidence;
    expect(evidence.factorId).toBe('title');
    expect(evidence.failingChecks).toEqual([
      {
        id: 'title-keyword',
        label: 'Put “habit tracker” in your title',
        status: 'fail',
        score: 0,
      },
    ]);
  });

  it('reports the AI seam as unconfigured and refuses to explain', async () => {
    const id = await seedAction();

    const status = await api.get('/actions/ai-status').expect(200);
    expect(status.body).toEqual({ configured: false, model: null });

    await api.post(`/actions/${id}/explain`).expect(409);
  });
});
