import './daily-redis';
import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { BullExplorer } from '@nestjs/bullmq/dist/bull.explorer';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AlertPayload } from '@asobeast/shared';
import { Job, Queue, Worker } from 'bullmq';
import { ActionsGenerator } from '../../src/actions/actions.generator';
import { ActionsNotifier } from '../../src/actions/actions.notifier';
import { AlertFlushService } from '../../src/alerts/alert-flush.service';
import { MailerService } from '../../src/alerts/mailer.service';
import { WebhookDelivery } from '../../src/alerts/webhook-delivery';
import { AppModule } from '../../src/app.module';
import { AuditService } from '../../src/audit/audit.service';
import { AccountDeletionService } from '../../src/account/account-deletion.service';
import { CrossTenantAccess } from '../../src/common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../../src/common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../../src/common/tenancy/workspace-fanout';
import { ProxyPoolMaintenance } from '../../src/store-providers/egress/proxy-pool.maintenance';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';
import { Env } from '../../src/config/env';
import { DigestDispatcher } from '../../src/jobs/digest.dispatcher';
import { QUEUES } from '../../src/jobs/jobs.types';
import { DailyBudgetService } from '../../src/jobs/daily-budget.service';
import { PipelineService } from '../../src/jobs/pipeline.service';
import { PipelineWorker } from '../../src/jobs/pipeline.worker';
import { RetentionService } from '../../src/jobs/retention.service';
import { StoreJobsHandler } from '../../src/jobs/store-jobs.handler';
import {
  obliterateQueues,
  pauseQueues,
  waitForIdleQueues,
} from '../obliterate-queues';
import { useCookies } from './session';
import { asWorkspace } from './tenancy';
import { testDb } from './test-db';

const TRUNCATED_TABLES =
  '"App", "Keyword", "AlertEvent", "Webhook", "EmailAlert", "AlertDelivery"';

export const ALERT_WEBHOOK_URL = 'https://hooks.example.com/test';

export type AlertEventName = 'rank.dropped' | 'metadata.changed';

export interface PipelineHarness {
  app: INestApplication;
  prisma: PrismaClient;
  pipeline: PipelineService;
  budget: DailyBudgetService;
  pipelineWorker: PipelineWorker;
  storeJobs: { handle: jest.Mock<Promise<void>, [Job]> };
  webhookDelivery: {
    send: jest.Mock<Promise<void>, [string, string | null, AlertPayload]>;
    attempt: jest.Mock;
  };
  mailer: { enabled: boolean; send: jest.Mock };
  queue: (name: string) => Queue;
  allJobs: (name: string) => Promise<Job[]>;
  resumeQueues: () => Promise<void>;
  waitFor: (
    assertion: () => void | Promise<void>,
    timeout?: number,
  ) => Promise<void>;
  seedApp: (
    store: Store,
    storeAppId: string,
    isCompetitor?: boolean,
    primaryAppId?: string | null,
    country?: string,
  ) => Promise<{ id: string; workspaceId: string }>;
  seedKeyword: (
    appId: string,
    store: Store,
    text: string,
    country?: string,
  ) => Promise<{ id: string }>;
  seedAlert: (
    appId: string,
    dedupeKey: string,
    event: AlertEventName,
  ) => Promise<void>;
  seedWebhook: () => Promise<unknown>;
  asWorkspace: <T>(work: () => Promise<T>) => Promise<T>;
  reset: () => Promise<void>;
  settle: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createPipelineHarness(): Promise<PipelineHarness> {
  const storeJobs = {
    handle: jest.fn<Promise<void>, [Job]>().mockResolvedValue(undefined),
  };
  const webhookDelivery = {
    send: jest
      .fn<Promise<void>, [string, string | null, AlertPayload]>()
      .mockResolvedValue(undefined),
    attempt: jest.fn(),
  };
  const mailer = {
    enabled: true,
    send: jest.fn().mockResolvedValue(undefined),
  };

  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StoreJobsHandler)
    .useValue(storeJobs)
    .overrideProvider(WebhookDelivery)
    .useValue(webhookDelivery)
    .overrideProvider(MailerService)
    .useValue(mailer)
    .compile();

  const app = moduleFixture.createNestApplication();
  useCookies(app);
  await app.init();
  await app.get(BullExplorer, { strict: false }).onApplicationShutdown();

  const queue = (name: string): Queue =>
    app.get<Queue>(getQueueToken(name), { strict: false });

  await pauseQueues(app);
  await obliterateQueues(app);
  await queue(QUEUES.PIPELINE).obliterate({ force: true });
  await pauseQueues(app);

  const prisma = testDb();
  const pipeline = app.get(PipelineService);
  const budget = app.get(DailyBudgetService);
  const pipelineWorker = new PipelineWorker(
    queue(QUEUES.PIPELINE),
    app.get(ConfigService<Env, true>),
    pipeline,
    budget,
    app.get(RetentionService),
    app.get(AccountDeletionService),
    app.get(DigestDispatcher),
    app.get(AuditService),
    app.get(AlertFlushService),
    app.get(ActionsGenerator),
    app.get(ActionsNotifier),
    app.get(CrossTenantAccess),
    app.get(WorkspaceContext),
    app.get(WorkspaceFanOut),
    app.get(ProxyPoolMaintenance),
  );

  const workerFor = (
    name: string,
    process: (job: Job) => Promise<void>,
    concurrency: number,
  ): Worker => {
    const target = queue(name);
    return new Worker(name, process, {
      connection: target.opts.connection,
      prefix: target.opts.prefix,
      concurrency,
    });
  };

  let runtimeWorkers: Worker[] = [];

  const startWorkers = async (): Promise<void> => {
    runtimeWorkers = [
      workerFor(QUEUES.PIPELINE, (job) => pipelineWorker.process(job), 1),
      ...[QUEUES.APP_STORE, QUEUES.GPLAY].map((name) =>
        workerFor(name, (job) => storeJobs.handle(job), 10),
      ),
      workerFor(
        QUEUES.ALERTS,
        async (job) => {
          const data = job.data as { payload: AlertPayload };
          await webhookDelivery.send(ALERT_WEBHOOK_URL, null, data.payload);
        },
        5,
      ),
    ];
    await Promise.all(runtimeWorkers.map((worker) => worker.waitUntilReady()));
  };

  const stopWorkers = (): Promise<void[]> =>
    Promise.all(runtimeWorkers.map((worker) => worker.close(true)));

  await startWorkers();

  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
  });

  const allJobs = (name: string): Promise<Job[]> =>
    queue(name).getJobs([
      'wait',
      'paused',
      'waiting-children',
      'active',
      'delayed',
      'completed',
      'failed',
    ]);

  return {
    app,
    prisma,
    pipeline,
    budget,
    pipelineWorker,
    storeJobs,
    webhookDelivery,
    mailer,
    queue,
    allJobs,

    resumeQueues: async () => {
      await Promise.all(
        Object.values(QUEUES).map((name) => queue(name).resume()),
      );
    },

    waitFor: async (assertion, timeout = 15_000) => {
      const deadline = Date.now() + timeout;
      let lastError: unknown;
      while (Date.now() < deadline) {
        try {
          await assertion();
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      throw lastError;
    },

    seedApp: (
      store,
      storeAppId,
      isCompetitor = false,
      primaryAppId = null,
      country = 'us',
    ) =>
      prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store,
          storeAppId,
          country,
          name: storeAppId,
          isCompetitor,
          primaryAppId,
        },
      }),

    seedKeyword: async (appId, store, text, country = 'us') => {
      const keyword = await prisma.keyword.create({
        data: { text, store, country },
      });
      await prisma.trackedKeyword.create({
        data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
      });
      return keyword;
    },

    seedAlert: async (appId, dedupeKey, event) => {
      const payload =
        event === 'rank.dropped'
          ? {
              event,
              occurredAt: '2026-07-27T03:30:00.000Z',
              app: { id: appId, name: 'Primary' },
              keyword: { id: 'keyword', text: 'planner' },
              from: 3,
              to: 12,
              threshold: 5,
            }
          : {
              event,
              occurredAt: '2026-07-27T03:31:00.000Z',
              app: { id: appId, name: 'Competitor', isCompetitor: true },
              changes: [{ field: 'title', before: 'Old', after: 'New' }],
            };
      await prisma.alertEvent.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          appId,
          event,
          dedupeKey,
          payload,
        },
      });
    },

    seedWebhook: () =>
      prisma.webhook.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          url: 'https://hooks.example.com/daily',
          events: ['rank.dropped', 'metadata.changed'],
        },
      }),

    asWorkspace: (work) => asWorkspace(app, work),

    reset: async () => {
      await pauseQueues(app);
      await waitForIdleQueues(app);
      await stopWorkers();
      await obliterateQueues(app);
      await queue(QUEUES.PIPELINE).obliterate({ force: true });
      await pauseQueues(app);
      await startWorkers();
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${TRUNCATED_TABLES} RESTART IDENTITY CASCADE`,
      );
      storeJobs.handle.mockReset().mockResolvedValue(undefined);
      webhookDelivery.send.mockReset().mockResolvedValue(undefined);
      webhookDelivery.attempt.mockReset();
      mailer.send.mockReset().mockResolvedValue(undefined);
    },

    settle: async () => {
      await pauseQueues(app);
      await waitForIdleQueues(app);
    },

    close: async () => {
      await prisma.$disconnect();
      await pauseQueues(app);
      await stopWorkers();
      await obliterateQueues(app);
      await queue(QUEUES.PIPELINE).obliterate({ force: true });
      await app.close();
    },
  };
}
