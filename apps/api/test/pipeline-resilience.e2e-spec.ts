import { getFlowProducerToken } from '@nestjs/bullmq';
import { Store } from '@prisma/client';
import { FlowJob, FlowProducer, Job, WorkerOptions } from 'bullmq';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createPipelineHarness,
  type PipelineHarness,
} from './helpers/pipeline-harness';
import { ownerAgent } from './helpers/session';
import { AppStoreWorker } from '../src/jobs/app-store.worker';
import { GplayWorker } from '../src/jobs/gplay.worker';
import { requestsFor } from '../src/jobs/request-weights';
import {
  dailyCompleteJobId,
  FLOW_PRODUCERS,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../src/jobs/jobs.types';

const BROKEN_APP = 'broken-primary';

describe('Pipeline resilience (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: PipelineHarness;

  const refreshJobsFor = async (appId: string): Promise<Job[]> => {
    const jobs = await Promise.all([
      harness.allJobs(QUEUES.APP_STORE),
      harness.allJobs(QUEUES.GPLAY),
    ]);
    return jobs
      .flat()
      .filter(
        (job) =>
          job.name === JOBS.REFRESH_APP &&
          (job.data as { appId?: string }).appId === appId,
      );
  };

  const failFor = (appId: string): void => {
    harness.storeJobs.handle.mockImplementation((job: Job) => {
      const data = job.data as { appId?: string };
      if (job.name === JOBS.REFRESH_APP && data.appId === appId) {
        return Promise.reject(new Error('injected provider parse failure'));
      }
      return Promise.resolve();
    });
  };

  const fanOutWithFastRetries = async (attempts: number): Promise<void> => {
    const producer = harness.app.get<FlowProducer>(
      getFlowProducerToken(FLOW_PRODUCERS.DAILY_PIPELINE),
      { strict: false },
    );
    const originalAdd = producer.add.bind(producer);
    const spy = jest
      .spyOn(producer, 'add')
      .mockImplementationOnce((flow: FlowJob, options) =>
        originalAdd(
          {
            ...flow,
            children: flow.children?.map((child) => ({
              ...child,
              opts: {
                ...child.opts,
                attempts,
                backoff: { type: 'fixed', delay: 25 },
              },
            })),
          },
          options,
        ),
      );
    try {
      await harness.asWorkspace(() => harness.pipeline.fanOutDaily());
    } finally {
      spy.mockRestore();
    }
  };

  beforeAll(async () => {
    harness = await createPipelineHarness();
  });

  beforeEach(() => harness.reset());
  afterEach(() => harness.settle());
  afterAll(() => harness.close());

  it('contains a provider failure to its own job and keeps the others whole', async () => {
    const broken = await harness.seedApp(Store.APP_STORE, BROKEN_APP);
    const healthyApple = await harness.seedApp(Store.APP_STORE, 'healthy-ios');
    const healthyPlay = await harness.seedApp(
      Store.GOOGLE_PLAY,
      'healthy-play',
    );
    failFor(broken.id);

    await harness.asWorkspace(() => harness.pipeline.fanOutDaily());
    await harness.resumeQueues();

    await harness.waitFor(async () => {
      const [failing] = await refreshJobsFor(broken.id);
      expect(failing?.attemptsMade).toBeGreaterThanOrEqual(1);
    });

    const [failing] = await refreshJobsFor(broken.id);
    expect(['delayed', 'failed']).toContain(await failing.getState());
    expect(typeof failing.opts.attempts).toBe('number');
    expect(failing.attemptsMade).toBeLessThan(Number(failing.opts.attempts));
    expect(failing.failedReason).toContain('injected provider parse failure');

    for (const healthy of [healthyApple, healthyPlay]) {
      const [job] = await refreshJobsFor(healthy.id);
      expect(await job.getState()).toBe('completed');
      expect(job.failedReason).toBeFalsy();
    }
  });

  it('retries the failing job until its attempts are spent, then gives up', async () => {
    const broken = await harness.seedApp(Store.APP_STORE, BROKEN_APP);
    const healthy = await harness.seedApp(Store.APP_STORE, 'healthy-ios');
    failFor(broken.id);

    await fanOutWithFastRetries(2);
    await harness.resumeQueues();

    await harness.waitFor(async () => {
      const [job] = await refreshJobsFor(broken.id);
      expect(await job?.getState()).toBe('failed');
      expect(job?.attemptsMade).toBe(2);
    });

    const [survivor] = await refreshJobsFor(healthy.id);
    expect(await survivor.getState()).toBe('completed');
  });

  it('keeps serving http requests while a provider job is failing', async () => {
    const broken = await harness.seedApp(Store.APP_STORE, BROKEN_APP);
    await harness.seedApp(Store.APP_STORE, 'healthy-ios');
    const agent = await ownerAgent(harness.app as never);

    let releaseFailure: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    harness.storeJobs.handle.mockImplementation(async (job: Job) => {
      const data = job.data as { appId?: string };
      if (job.name === JOBS.REFRESH_APP && data.appId === broken.id) {
        await held;
        throw new Error('injected provider parse failure');
      }
    });

    await harness.asWorkspace(() => harness.pipeline.fanOutDaily());
    await harness.resumeQueues();

    try {
      await harness.waitFor(async () => {
        const [inFlight] = await refreshJobsFor(broken.id);
        expect(await inFlight?.getState()).toBe('active');
      });

      await agent.get('/apps').expect(200);
      await agent.get('/health').expect(200);
      await agent.get('/jobs/budget').expect(200);
    } finally {
      releaseFailure?.();
    }

    await harness.waitFor(async () => {
      const [failed] = await refreshJobsFor(broken.id);
      expect(failed?.failedReason).toContain('injected provider parse failure');
    });
  });

  it('flushes alerts and closes the claim when part of the fan-out fails', async () => {
    const broken = await harness.seedApp(Store.APP_STORE, BROKEN_APP);
    const healthy = await harness.seedApp(Store.APP_STORE, 'healthy-ios');
    await harness.seedAlert(healthy.id, 'resilience-owned', 'rank.dropped');
    await harness.seedWebhook();
    failFor(broken.id);

    await fanOutWithFastRetries(1);
    await harness.resumeQueues();

    await harness.waitFor(async () => {
      const root = await harness
        .queue(QUEUES.PIPELINE)
        .getJob(dailyCompleteJobId(utcDateKey()));
      expect(await root?.getState()).toBe('completed');
    });

    await harness.waitFor(() => {
      expect(harness.webhookDelivery.send).toHaveBeenCalledTimes(1);
    });

    const events = await harness.prisma.alertEvent.findMany({
      select: { flushedAt: true, claimedAt: true, flushId: true },
    });
    expect(events).toHaveLength(1);
    expect(events[0].flushedAt).not.toBeNull();
    expect(events[0].claimedAt).not.toBeNull();
    expect(events[0].flushId).not.toBeNull();
  });

  it('reports the real fan-out counts rather than the pre-run targets', async () => {
    await harness.seedApp(Store.APP_STORE, BROKEN_APP);
    const healthy = await harness.seedApp(Store.APP_STORE, 'healthy-ios');
    await harness.seedKeyword(healthy.id, Store.APP_STORE, 'planner');

    const summary = await harness.asWorkspace(() =>
      harness.pipeline.fanOutDaily(),
    );
    const root = await harness
      .queue(QUEUES.PIPELINE)
      .getJob(dailyCompleteJobId(utcDateKey()));

    expect(summary).toMatchObject({ apps: 2, keywords: 1, reviews: 2 });
    expect(root?.data).toMatchObject({
      date: utcDateKey(),
      apps: summary.apps,
      keywords: summary.keywords,
      reviews: summary.reviews,
      categories: summary.categories,
    });
  });

  it('keeps a retried daily job idempotent for rankings and snapshots', async () => {
    const app = await harness.seedApp(Store.APP_STORE, 'idempotent-ios');
    const keyword = await harness.seedKeyword(
      app.id,
      Store.APP_STORE,
      'planner',
    );
    const date = new Date(`${utcDateKey()}T00:00:00.000Z`);

    const writeRanking = () =>
      harness.prisma.keywordRanking.upsert({
        where: {
          appId_keywordId_date: {
            appId: app.id,
            keywordId: keyword.id,
            date,
          },
        },
        create: {
          appId: app.id,
          workspaceId: app.workspaceId,
          keywordId: keyword.id,
          date,
          position: 12,
          depth: 200,
        },
        update: { position: 9, depth: 200 },
      });

    await writeRanking();
    await writeRanking();

    const rankings = await harness.prisma.keywordRanking.findMany({
      where: { appId: app.id, keywordId: keyword.id },
    });
    expect(rankings).toHaveLength(1);
    expect(rankings[0].position).toBe(9);

    await harness.asWorkspace(() => harness.pipeline.fanOutDaily());
    const before = await refreshJobsFor(app.id);
    await harness.asWorkspace(() => harness.pipeline.fanOutDaily());
    const after = await refreshJobsFor(app.id);

    expect(before).toHaveLength(1);
    expect(after.map((job) => job.id)).toEqual(before.map((job) => job.id));
  });

  it('matches the budget estimate to the jobs the fan-out enqueues', async () => {
    const apple = await harness.seedApp(Store.APP_STORE, 'budget-ios');
    const play = await harness.seedApp(Store.GOOGLE_PLAY, 'budget-play');
    await harness.seedKeyword(apple.id, Store.APP_STORE, 'planner', 'us');
    await harness.seedKeyword(apple.id, Store.APP_STORE, 'planner', 'gb');
    await harness.seedKeyword(play.id, Store.GOOGLE_PLAY, 'planner', 'us');

    const budget = await harness.asWorkspace(() => harness.budget.estimate());
    const summary = await harness.asWorkspace(() =>
      harness.pipeline.fanOutDaily(),
    );

    expect(budget.apps).toBe(summary.apps);
    expect(budget.keywords).toBe(summary.keywords);
    expect(budget.reviews).toBe(summary.reviews);
    expect(budget.categories).toBe(summary.categories);
    expect(budget.total).toBe(
      requestsFor('APP_STORE', {
        apps: 1,
        keywords: 2,
        categories: 0,
        reviews: 1,
      }) +
        requestsFor('GOOGLE_PLAY', {
          apps: 1,
          keywords: 1,
          categories: 0,
          reviews: 1,
        }),
    );

    const enqueued = (
      await Promise.all([
        harness.allJobs(QUEUES.APP_STORE),
        harness.allJobs(QUEUES.GPLAY),
      ])
    )
      .flat()
      .filter((job) => job.id?.startsWith('daily~'));
    expect(enqueued).toHaveLength(
      summary.apps + summary.keywords + summary.categories + summary.reviews,
    );
  });

  it('counts the same phrase in two markets as two searches', async () => {
    const apple = await harness.seedApp(Store.APP_STORE, 'market-ios');
    await harness.seedKeyword(apple.id, Store.APP_STORE, 'planner', 'us');
    await harness.seedKeyword(apple.id, Store.APP_STORE, 'planner', 'gb');

    const budget = await harness.asWorkspace(() => harness.budget.estimate());

    expect(budget.keywords).toBe(2);
    expect(
      budget.stores.find((store) => store.store === 'APP_STORE')?.keywords,
    ).toBe(2);
    expect(
      budget.stores.find((store) => store.store === 'GOOGLE_PLAY')?.keywords,
    ).toBe(0);
  });

  it('exposes the same budget through the http surface', async () => {
    const apple = await harness.seedApp(Store.APP_STORE, 'http-budget-ios');
    await harness.seedKeyword(apple.id, Store.APP_STORE, 'planner');
    const agent = await ownerAgent(harness.app as never);

    const response = await agent.get('/jobs/budget').expect(200);
    const budget = await harness.asWorkspace(() => harness.budget.estimate());

    expect(response.body).toMatchObject({
      apps: budget.apps,
      keywords: budget.keywords,
      total: budget.total,
    });
  });

  it('rate limits both store workers from their configured budget', () => {
    const optionsFor = (worker: object): WorkerOptions =>
      Reflect.getMetadata('bullmq:worker_metadata', worker) as WorkerOptions;

    const appStore = optionsFor(AppStoreWorker);
    const gplay = optionsFor(GplayWorker);

    for (const options of [appStore, gplay]) {
      expect(options.concurrency).toBe(1);
      expect(options.limiter?.duration).toBe(60_000);
      expect(options.limiter?.max).toBeGreaterThan(0);
    }

    expect(appStore.limiter?.max).toBe(
      Number(process.env.SCRAPE_ITUNES_RPM) || 15,
    );
    expect(gplay.limiter?.max).toBe(Number(process.env.SCRAPE_GPLAY_RPM) || 10);
  });

  it('delays rather than fails jobs when more arrive than the window allows', async () => {
    const app = await harness.seedApp(Store.APP_STORE, 'limited-ios');
    const queue = harness.queue(QUEUES.APP_STORE);
    const seen: string[] = [];
    harness.storeJobs.handle.mockImplementation((job: Job) => {
      seen.push(job.id ?? '');
      return Promise.resolve();
    });

    for (let index = 0; index < 6; index += 1) {
      await queue.add(
        JOBS.REFRESH_APP,
        { appId: app.id },
        { jobId: `limiter~${index}`, attempts: 1 },
      );
    }

    await harness.resumeQueues();
    await harness.waitFor(() => {
      expect(seen).toHaveLength(6);
    });

    expect(await queue.getFailedCount()).toBe(0);
    expect(new Set(seen).size).toBe(6);
  });

  it('answers an unauthenticated read while the pipeline is degraded', async () => {
    await harness.seedApp(Store.APP_STORE, BROKEN_APP);
    const response = await request(harness.app.getHttpServer() as App).get(
      '/health',
    );

    expect([200, 503]).toContain(response.status);
    expect(response.body).toMatchObject({ db: 'up' });
  });
});
