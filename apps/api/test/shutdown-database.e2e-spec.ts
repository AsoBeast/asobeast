import './helpers/drain-redis';
import { execSync } from 'child_process';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  answerOf,
  elapse,
  lockUserTable,
  pendingAfter,
} from './helpers/held-query';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const QUERY_SETTLE_MS = 300;
const STILL_STOPPING_MS = 500;

describe('Shutdown keeps postgres until open work finishes (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let inspector: Queue;
  let closed = false;
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = (): void => undefined;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });

  const handle = jest.fn(async (): Promise<void> => {
    started();
    await released;
    await app.get(PrismaService).workspace.count();
  });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreJobsHandler)
      .useValue({ handle })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
    await obliterateQueues(app);

    const queue = app.get<Queue>(getQueueToken(QUEUES.APP_STORE), {
      strict: false,
    });
    inspector = new Queue(QUEUES.APP_STORE, {
      connection: queue.opts.connection,
      prefix: queue.opts.prefix,
    });
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  afterAll(async () => {
    release();
    if (!closed) await app?.close();
    await inspector?.obliterate({ force: true });
    await inspector?.close();
    await prisma?.$disconnect();
  });

  it('answers a request that is in its query when the stop begins and drains a job that queries after it', async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.APP_STORE), {
      strict: false,
    });
    const queued = await queue.add(
      JOBS.CHECK_KEYWORD,
      { workspaceId: DEFAULT_WORKSPACE_ID, keywordId: 'keyword-in-flight' },
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );
    await running;

    const port = ((app.getHttpServer() as Server).address() as AddressInfo)
      .port;
    const lock = await lockUserTable(prisma);
    const answer = answerOf(port, '/auth/status');
    expect(await pendingAfter(answer, QUERY_SETTLE_MS)).toBe(true);

    const closing = app.close().then(() => {
      closed = true;
    });
    expect(await pendingAfter(closing, STILL_STOPPING_MS)).toBe(true);
    await lock.release();
    await elapse(QUERY_SETTLE_MS);
    release();
    await closing;

    const drained = await Job.fromId(inspector, String(queued.id));
    expect({
      request: await answer,
      job: await drained?.getState(),
      reason: drained?.failedReason,
    }).toEqual({ request: 200, job: 'completed', reason: undefined });
  });
});
