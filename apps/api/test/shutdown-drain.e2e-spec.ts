import './helpers/drain-redis';
import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const STILL_DRAINING_MS = 500;

interface Signal {
  reached: Promise<void>;
  reach: () => void;
}

const signal = (): Signal => {
  let reach = (): void => undefined;
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  return { reached, reach };
};

const settledWithin = (work: Promise<unknown>, ms: number): Promise<boolean> =>
  Promise.race([
    work.then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);

describe('Shutdown drains an active job (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let inspector: Queue;
  let closed = false;

  const started = signal();
  const release = signal();

  const handle = jest.fn(async (): Promise<void> => {
    started.reach();
    await release.reached;
  });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreJobsHandler)
      .useValue({ handle })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

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
    release.reach();
    if (!closed) await app?.close();
    await inspector?.obliterate({ force: true });
    await inspector?.close();
    await prisma?.$disconnect();
  });

  it('lets a job that is already running finish instead of killing it', async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.APP_STORE), {
      strict: false,
    });
    const queued = await queue.add(
      JOBS.CHECK_KEYWORD,
      { workspaceId: DEFAULT_WORKSPACE_ID, keywordId: 'keyword-in-flight' },
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );

    await started.reached;
    expect(await queued.getState()).toBe('active');

    const closing = app.close().then(() => {
      closed = true;
    });

    expect(await settledWithin(closing, STILL_DRAINING_MS)).toBe(false);
    expect(handle).toHaveBeenCalledTimes(1);

    release.reach();
    await closing;

    const drained = await Job.fromId(inspector, String(queued.id));
    if (!drained)
      throw new Error('the job vanished from the queue on shutdown');
    expect(await drained.getState()).toBe('completed');
  });
});
