import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { getFlowProducerToken, getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  AlertBatchPayload,
  AlertFlushResult,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
} from '@asobeast/shared';
import { FlowProducer, Job, Queue, Worker } from 'bullmq';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  FLOW_PRODUCERS,
  JOBS,
  QUEUES,
} from '../src/jobs/jobs.types';
import { AlertFlushService } from '../src/alerts/alert-flush.service';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { asWorkspace } from './helpers/tenancy';

describe('Alert flush (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let flushService: AlertFlushService;

  const alertsQueue = (): Queue<DeliverAlertPayload | DeliverEmailPayload> =>
    app.get(getQueueToken(QUEUES.ALERTS), { strict: false });

  const alertFlowProducer = (): FlowProducer =>
    app.get(getFlowProducerToken(FLOW_PRODUCERS.ALERT_DELIVERY), {
      strict: false,
    });

  const pendingJobs = (): Promise<
    Job<DeliverAlertPayload | DeliverEmailPayload>[]
  > => alertsQueue().getJobs(['wait', 'paused', 'delayed', 'waiting-children']);

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    flushService = app.get(AlertFlushService);
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
      'TRUNCATE TABLE "App", "AlertEvent", "Webhook", "EmailAlert" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedApp = async (
    name: string,
    isCompetitor = false,
    primaryAppId: string | null = null,
  ): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: name,
        country: 'us',
        name,
        isCompetitor,
        primaryAppId,
      },
    });
    return created.id;
  };

  const seedEvent = async (
    event: string,
    appId: string | null,
    dedupeKey: string,
    payload: unknown,
  ): Promise<string> => {
    const created = await prisma.alertEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        event,
        appId,
        dedupeKey,
        payload: payload as object,
      },
    });
    return created.id;
  };

  const rankPayload = (appId: string, to: number): RankDroppedPayload => ({
    event: 'rank.dropped',
    occurredAt: '2026-07-22T10:00:00.000Z',
    app: { id: appId, name: 'primary' },
    keyword: { id: 'kw1', text: 'game' },
    from: 3,
    to,
    fromDepth: RANK_DEPTH,
    toDepth: RANK_DEPTH,
    threshold: 5,
  });

  const seedMixedChannel = async (suffix: string): Promise<void> => {
    const primary = await seedApp(`primary-${suffix}`);
    const competitor = await seedApp(`competitor-${suffix}`, true, primary);
    await seedEvent(
      'rank.dropped',
      primary,
      `rank:${suffix}`,
      rankPayload(primary, 12),
    );
    await seedEvent('metadata.changed', competitor, `competitor:${suffix}`, {
      event: 'metadata.changed',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: competitor, name: 'competitor', isCompetitor: true },
      changes: [{ field: 'title', before: 'x', after: 'y' }],
    } satisfies MetadataChangedPayload);
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: `https://hooks.example.com/${suffix}`,
        events: ['rank.dropped', 'metadata.changed'],
      },
    });
  };

  const observeMixedFlow = async (failOwned: boolean): Promise<string[]> => {
    const scopes: string[] = [];
    let resolveCompetitor: (() => void) | undefined;
    const competitorProcessed = new Promise<void>((resolve) => {
      resolveCompetitor = resolve;
    });
    const sourceJobs = await pendingJobs();
    const sourceOwned = sourceJobs.find(
      (job) =>
        job.data.payload.event === 'alerts.batch' &&
        job.data.payload.scope === 'owned_apps',
    );
    const sourceCompetitor = sourceJobs.find(
      (job) =>
        job.data.payload.event === 'alerts.batch' &&
        job.data.payload.scope === 'competitors',
    );
    if (!sourceOwned || !sourceCompetitor) {
      throw new Error('scoped delivery flow missing');
    }
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6380),
      db: Number(process.env.REDIS_DB ?? 1),
    };
    const prefix = `phase37-${randomUUID()}`;
    const queue = new Queue<DeliverAlertPayload | DeliverEmailPayload>(
      QUEUES.ALERTS,
      { connection, prefix },
    );
    const producer = new FlowProducer({ connection, prefix });
    let timeout: NodeJS.Timeout | undefined;
    const processPayload = (payload: AlertBatchPayload): void => {
      scopes.push(payload.scope);
      if (payload.scope === 'owned_apps' && failOwned) {
        throw new Error('owned delivery failed');
      }
      if (payload.scope === 'competitors') resolveCompetitor?.();
    };
    const worker = new Worker<DeliverAlertPayload | DeliverEmailPayload>(
      QUEUES.ALERTS,
      (job) => {
        const payload = job.data.payload;
        if (payload.event === 'alerts.batch') processPayload(payload);
      },
      { connection, prefix, concurrency: 4 },
    );
    try {
      await worker.waitUntilReady();
      const tree = await producer.add({
        name: sourceCompetitor.name,
        queueName: QUEUES.ALERTS,
        prefix,
        data: sourceCompetitor.data,
        opts: { ...sourceCompetitor.opts, jobId: sourceCompetitor.id },
        children: [
          {
            name: sourceOwned.name,
            queueName: QUEUES.ALERTS,
            prefix,
            data: sourceOwned.data,
            opts: { ...sourceOwned.opts, jobId: sourceOwned.id },
          },
        ],
      });
      await Promise.race([
        competitorProcessed,
        new Promise<void>((_, reject) => {
          const rejectWithState = async (): Promise<void> => {
            const states = await Promise.all(
              (
                await queue.getJobs([
                  'wait',
                  'paused',
                  'active',
                  'delayed',
                  'waiting-children',
                  'completed',
                  'failed',
                ])
              ).map(async (job) => ({
                id: job.id,
                state: await job.getState(),
                attemptsMade: job.attemptsMade,
                failedReason: job.failedReason,
              })),
            );
            reject(
              new Error(
                `competitor delivery timed out: ${scopes.join(',')} ${JSON.stringify(states)}`,
              ),
            );
          };
          timeout = setTimeout(() => void rejectWithState(), 25_000);
        }),
      ]);
      const deadline = Date.now() + 5_000;
      while ((await tree.job.getState()) !== 'completed') {
        if (Date.now() >= deadline) {
          throw new Error('competitor delivery did not complete');
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      await worker.close();
      await queue.obliterate({ force: true });
      await producer.close();
      await queue.close();
    }
    return scopes;
  };

  it('keeps pre-claim rows queryable with null claim fields', async () => {
    const primary = await seedApp('primary');
    const flushedAt = new Date('2026-07-22T12:00:00.000Z');

    await prisma.alertEvent.createMany({
      data: [
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          event: 'rank.dropped',
          appId: primary,
          dedupeKey: `pending:${primary}`,
          payload: rankPayload(primary, 12),
        },
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          event: 'rank.dropped',
          appId: primary,
          dedupeKey: `flushed:${primary}`,
          payload: rankPayload(primary, 20),
          flushedAt,
        },
      ],
    });

    const rows = await prisma.alertEvent.findMany({
      orderBy: { dedupeKey: 'asc' },
      select: {
        dedupeKey: true,
        flushedAt: true,
        flushId: true,
        claimedAt: true,
      },
    });

    expect(rows).toEqual([
      {
        dedupeKey: `flushed:${primary}`,
        flushedAt,
        flushId: null,
        claimedAt: null,
      },
      {
        dedupeKey: `pending:${primary}`,
        flushedAt: null,
        flushId: null,
        claimedAt: null,
      },
    ]);
  });

  it('reports unclaimed, claimed and last-flushed rows separately', async () => {
    const primary = await seedApp('status-primary');
    await seedEvent(
      'rank.dropped',
      primary,
      `pending:${primary}`,
      rankPayload(primary, 12),
    );
    const claimedId = await seedEvent(
      'rank.dropped',
      primary,
      `claimed:${primary}`,
      rankPayload(primary, 20),
    );
    const flushedId = await seedEvent(
      'rank.dropped',
      primary,
      `flushed:${primary}`,
      rankPayload(primary, 30),
    );
    const claimedAt = new Date('2026-07-22T11:00:00.000Z');
    const flushedAt = new Date('2026-07-22T12:00:00.000Z');
    await prisma.alertEvent.update({
      where: { id: claimedId },
      data: { flushId: 'status-claim', claimedAt },
    });
    await prisma.alertEvent.update({
      where: { id: flushedId },
      data: { flushedAt },
    });

    const response = await api.get('/alerts/delivery').expect(200);

    expect(response.body).toEqual({
      mode: 'batched',
      pipelineCron: '0 3 * * *',
      trigger: 'daily_pipeline_completion',
      lastFlushAt: flushedAt.toISOString(),
      pending: 1,
      claimed: 1,
    });
  });

  it('flushes a day of events into one grouped job per subscribed channel', async () => {
    const primary = await seedApp('primary');
    const competitor = await seedApp('competitor', true, primary);

    await seedEvent(
      'rank.dropped',
      primary,
      `rank:${primary}:kw1:2026-07-22`,
      rankPayload(primary, 12),
    );
    await seedEvent(
      'metadata.changed',
      competitor,
      `change:${competitor}:title:2026-07-22`,
      {
        event: 'metadata.changed',
        occurredAt: '2026-07-22T10:00:00.000Z',
        app: { id: competitor, name: 'competitor', isCompetitor: true },
        changes: [{ field: 'title', before: 'x', after: 'y' }],
      } satisfies MetadataChangedPayload,
    );

    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped', 'metadata.changed'],
      },
    });
    const rankOnly = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/rank',
        events: ['rank.dropped'],
      },
    });
    const reviewOnly = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/review',
        events: ['review.negative'],
      },
    });
    const competitorOnly = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/competitor',
        events: ['metadata.changed'],
      },
    });
    await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'ops@example.com',
        events: ['rank.dropped', 'metadata.changed'],
      },
    });

    const response = await api.post('/alerts/flush').expect(201);
    const result = response.body as AlertFlushResult;
    expect(result.flushed).toBe(2);
    expect(result.channels).toBe(4);
    expect(result.notifications).toBe(6);

    const jobs = await pendingJobs();
    const webhookJobs = jobs.filter((job) => job.name === JOBS.DELIVER_ALERT);
    const emailJobs = jobs.filter((job) => job.name === JOBS.DELIVER_EMAIL);
    expect(webhookJobs).toHaveLength(4);
    expect(emailJobs).toHaveLength(2);

    const targets = webhookJobs.map(
      (job) => (job.data as DeliverAlertPayload).webhookId,
    );
    expect(targets).toContain(webhook.id);
    expect(targets).toContain(rankOnly.id);
    expect(targets).toContain(competitorOnly.id);
    expect(targets).not.toContain(reviewOnly.id);

    const fullOwned = webhookJobs.find(
      (job) =>
        (job.data as DeliverAlertPayload).webhookId === webhook.id &&
        job.id?.endsWith('owned_apps'),
    )!;
    const ownedBatch = (fullOwned.data as DeliverAlertPayload)
      .payload as AlertBatchPayload;
    expect(ownedBatch.scope).toBe('owned_apps');
    expect(ownedBatch.apps).toHaveLength(1);
    expect(ownedBatch.apps[0].rankDrops).toHaveLength(1);
    expect(ownedBatch.apps[0].competitors).toHaveLength(0);

    const fullCompetitors = webhookJobs.find(
      (job) =>
        (job.data as DeliverAlertPayload).webhookId === webhook.id &&
        job.id?.endsWith('competitors'),
    )!;
    const competitorBatch = (fullCompetitors.data as DeliverAlertPayload)
      .payload as AlertBatchPayload;
    expect(competitorBatch.scope).toBe('competitors');
    expect(competitorBatch.apps[0].rankDrops).toHaveLength(0);
    expect(competitorBatch.apps[0].competitors).toHaveLength(1);
    expect(await fullCompetitors.getState()).toBe('waiting-children');
    expect(fullOwned.parentKey).toContain(fullCompetitors.id);
    expect(fullOwned.opts.removeDependencyOnFailure).toBe(true);

    const competitorRoot = webhookJobs.find(
      (job) =>
        (job.data as DeliverAlertPayload).webhookId === competitorOnly.id,
    )!;
    expect((competitorRoot.data as DeliverAlertPayload).payload).toMatchObject({
      event: 'alerts.batch',
      scope: 'competitors',
    });
    expect(competitorRoot.parentKey).toBeUndefined();

    for (const job of jobs) {
      expect(job.opts).toMatchObject({
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 604800 },
        removeOnFail: 5000,
      });
    }

    const rankBatch = (
      webhookJobs.find(
        (job) => (job.data as DeliverAlertPayload).webhookId === rankOnly.id,
      )!.data as DeliverAlertPayload
    ).payload as AlertBatchPayload;
    expect(rankBatch.scope).toBe('owned_apps');
    expect(rankBatch.events.every((e) => e.event === 'rank.dropped')).toBe(
      true,
    );
    expect(rankBatch.apps[0].competitors).toHaveLength(0);

    const flushedRows = await prisma.alertEvent.count({
      where: { flushedAt: null },
    });
    expect(flushedRows).toBe(0);
  });

  it('deduplicates a repeated fact and keeps the latest values', async () => {
    const primary = await seedApp('primary');
    const key = `rank:${primary}:kw1:2026-07-22`;
    await seedEvent('rank.dropped', primary, key, rankPayload(primary, 12));
    await prisma.alertEvent.upsert({
      where: {
        workspaceId_dedupeKey: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          dedupeKey: key,
        },
      },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        event: 'rank.dropped',
        appId: primary,
        dedupeKey: key,
        payload: rankPayload(primary, 20),
      },
      update: { payload: rankPayload(primary, 20) },
    });
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped'],
      },
    });

    const response = await api.post('/alerts/flush').expect(201);
    expect((response.body as AlertFlushResult).flushed).toBe(1);

    const jobs = await pendingJobs();
    const batch = (jobs[0].data as DeliverAlertPayload)
      .payload as AlertBatchPayload;
    const drop = batch.apps[0].rankDrops[0];
    expect(drop.to).toBe(20);
  });

  it('delivers owned scope before its competitor parent', async () => {
    await seedMixedChannel('ordered-success');
    await asWorkspace(app, () => flushService.flush());

    await expect(observeMixedFlow(false)).resolves.toEqual([
      'owned_apps',
      'competitors',
    ]);
  });

  it('waits for owned retries to exhaust before releasing competitors', async () => {
    await seedMixedChannel('ordered-failure');
    await asWorkspace(app, () => flushService.flush());
    const jobs = await pendingJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.data.payload.event)).toEqual([
      'alerts.batch',
      'alerts.batch',
    ]);

    await expect(observeMixedFlow(true)).resolves.toEqual([
      'owned_apps',
      'owned_apps',
      'owned_apps',
      'competitors',
    ]);
  }, 45_000);

  it('creates one logical claim for simultaneous flush requests', async () => {
    const primary = await seedApp('primary');
    await seedEvent(
      'rank.dropped',
      primary,
      `rank:${primary}:kw1:2026-07-22`,
      rankPayload(primary, 12),
    );
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/concurrent',
        events: ['rank.dropped'],
      },
    });

    const [left, right] = await Promise.all([
      asWorkspace(app, () => flushService.flush()),
      asWorkspace(app, () => flushService.flush()),
    ]);

    expect(left.flushed + right.flushed).toBeGreaterThanOrEqual(1);
    const rows = await prisma.alertEvent.findMany({
      select: { flushId: true, claimedAt: true, flushedAt: true },
    });
    expect(new Set(rows.map((row) => row.flushId)).size).toBe(1);
    expect(rows[0].flushId).not.toBeNull();
    expect(rows[0].claimedAt).not.toBeNull();
    expect(rows[0].flushedAt).not.toBeNull();
    expect(await pendingJobs()).toHaveLength(1);
  });

  it('drains unfinished claims before a newly claimed snapshot', async () => {
    const primary = await seedApp('primary');
    const oldClaimedAt = new Date('2026-07-22T08:00:00.000Z');
    await prisma.alertEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        event: 'rank.dropped',
        appId: primary,
        dedupeKey: `old:${primary}`,
        payload: rankPayload(primary, 12),
        flushId: 'old-claim',
        claimedAt: oldClaimedAt,
      },
    });
    await seedEvent(
      'rank.dropped',
      primary,
      `new:${primary}`,
      rankPayload(primary, 20),
    );
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/recovery',
        events: ['rank.dropped'],
      },
    });

    const result = await asWorkspace(app, () => flushService.flush());

    expect(result).toEqual({ flushed: 2, channels: 1, notifications: 2 });
    const rows = await prisma.alertEvent.findMany({
      orderBy: { claimedAt: 'asc' },
      select: { flushId: true, claimedAt: true, flushedAt: true },
    });
    expect(rows[0]).toMatchObject({
      flushId: 'old-claim',
      claimedAt: oldClaimedAt,
    });
    expect(rows.every((row) => row.flushedAt !== null)).toBe(true);
    expect(await pendingJobs()).toHaveLength(2);
  });

  it('leaves rows inserted during delivery for the next flush', async () => {
    const primary = await seedApp('primary');
    const firstId = await seedEvent(
      'rank.dropped',
      primary,
      `first:${primary}`,
      rankPayload(primary, 12),
    );
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/fixed',
        events: ['rank.dropped'],
      },
    });
    const producer = alertFlowProducer();
    const originalAddBulk = producer.addBulk.bind(producer);
    const add = jest
      .spyOn(producer, 'addBulk')
      .mockImplementationOnce(async (...args) => {
        await seedEvent(
          'rank.dropped',
          primary,
          `later:${primary}`,
          rankPayload(primary, 20),
        );
        return originalAddBulk(...args);
      });

    try {
      await expect(
        asWorkspace(app, () => flushService.flush()),
      ).resolves.toEqual({
        flushed: 1,
        channels: 1,
        notifications: 1,
      });
    } finally {
      add.mockRestore();
    }

    const first = await prisma.alertEvent.findUniqueOrThrow({
      where: { id: firstId },
    });
    const later = await prisma.alertEvent.findFirstOrThrow({
      where: { dedupeKey: `later:${primary}` },
    });
    expect(first.flushedAt).not.toBeNull();
    expect(later).toMatchObject({
      flushId: null,
      claimedAt: null,
      flushedAt: null,
    });
  });

  it('resumes the same claim after a queue failure', async () => {
    const primary = await seedApp('primary');
    await seedEvent(
      'rank.dropped',
      primary,
      `rank:${primary}:kw1:2026-07-22`,
      rankPayload(primary, 12),
    );
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/retry',
        events: ['rank.dropped'],
      },
    });
    const add = jest
      .spyOn(alertFlowProducer(), 'addBulk')
      .mockRejectedValueOnce(new Error('injected queue failure'));

    await expect(asWorkspace(app, () => flushService.flush())).rejects.toThrow(
      'injected queue failure',
    );
    add.mockRestore();
    const claimed = await prisma.alertEvent.findFirstOrThrow();
    expect(claimed).toMatchObject({ flushedAt: null });
    expect(claimed.flushId).not.toBeNull();
    const firstClaim = claimed.flushId;
    const firstClaimedAt = claimed.claimedAt;

    await expect(asWorkspace(app, () => flushService.flush())).resolves.toEqual(
      {
        flushed: 1,
        channels: 1,
        notifications: 1,
      },
    );
    const completed = await prisma.alertEvent.findFirstOrThrow();
    expect(completed.flushId).toBe(firstClaim);
    expect(completed.claimedAt).toEqual(firstClaimedAt);
    expect(completed.flushedAt).not.toBeNull();
    const jobs = await pendingJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toContain(`flush~${firstClaim}~`);
  });

  it('does not complete a claim until every intended job is accepted', async () => {
    const primary = await seedApp('primary');
    await seedEvent(
      'rank.dropped',
      primary,
      `rank:${primary}:kw1:2026-07-22`,
      rankPayload(primary, 12),
    );
    await prisma.webhook.createMany({
      data: [
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          url: 'https://hooks.example.com/first',
          events: ['rank.dropped'],
        },
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          url: 'https://hooks.example.com/second',
          events: ['rank.dropped'],
        },
      ],
    });
    const producer = alertFlowProducer();
    const originalAddBulk = producer.addBulk.bind(producer);
    const add = jest
      .spyOn(producer, 'addBulk')
      .mockImplementationOnce(async (flows) => {
        await originalAddBulk([flows[0]]);
        throw new Error('second job failed');
      });

    await expect(asWorkspace(app, () => flushService.flush())).rejects.toThrow(
      'second job failed',
    );
    add.mockRestore();
    expect(await prisma.alertEvent.count({ where: { flushedAt: null } })).toBe(
      1,
    );

    await expect(asWorkspace(app, () => flushService.flush())).resolves.toEqual(
      {
        flushed: 1,
        channels: 2,
        notifications: 2,
      },
    );
    expect(await pendingJobs()).toHaveLength(2);
    expect(await prisma.alertEvent.count({ where: { flushedAt: null } })).toBe(
      0,
    );
  });

  it('completes a no-subscriber claim and makes the next flush a no-op', async () => {
    const primary = await seedApp('primary');
    await seedEvent(
      'rank.dropped',
      primary,
      `rank:${primary}:kw1:2026-07-22`,
      rankPayload(primary, 12),
    );

    await expect(asWorkspace(app, () => flushService.flush())).resolves.toEqual(
      {
        flushed: 1,
        channels: 0,
        notifications: 0,
      },
    );
    await expect(asWorkspace(app, () => flushService.flush())).resolves.toEqual(
      {
        flushed: 0,
        channels: 0,
        notifications: 0,
      },
    );
    expect(await pendingJobs()).toHaveLength(0);
  });

  it('sends nothing when the outbox is empty', async () => {
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped'],
      },
    });

    const response = await api.post('/alerts/flush').expect(201);
    expect(response.body as AlertFlushResult).toEqual({
      flushed: 0,
      channels: 0,
      notifications: 0,
    });
    expect(await pendingJobs()).toHaveLength(0);
  });
});
