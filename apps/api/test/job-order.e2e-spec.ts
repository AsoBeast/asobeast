import { Store } from '@prisma/client';
import { DelayedError, Job } from 'bullmq';
import {
  createPipelineHarness,
  type PipelineHarness,
} from './helpers/pipeline-harness';
import { ownerAgent } from './helpers/session';
import {
  DEFERRED_JOB_OPTIONS,
  SCHEDULED_JOB_OPTIONS,
} from '../src/jobs/job-options';
import { JOBS, QUEUES, checkJobId, utcDateKey } from '../src/jobs/jobs.types';

const isDaily = (jobId: string) => jobId.startsWith('daily~');

describe('Store job order (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: PipelineHarness;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const appStoreQueue = () => harness.queue(QUEUES.APP_STORE);

  const seedTrackedApp = async () => {
    const app = await harness.seedApp(Store.APP_STORE, 'things-3');
    const keywords = [
      await harness.seedKeyword(app.id, Store.APP_STORE, 'to do'),
      await harness.seedKeyword(app.id, Store.APP_STORE, 'task list'),
    ];
    return { app, keywords };
  };

  const fanOutDaily = () =>
    harness.asWorkspace(() => harness.pipeline.fanOutDaily());

  const dailyChecks = async () =>
    (await harness.allJobs(QUEUES.APP_STORE)).filter(
      (job) => job.id?.startsWith('daily~check~') ?? false,
    );

  const recordStarts = () => {
    const started: string[] = [];
    harness.storeJobs.handle.mockImplementation((job: Job) => {
      started.push(job.id ?? '');
      return Promise.resolve();
    });
    return started;
  };

  const runUntilIdle = async (started: string[], expected: number) => {
    await harness.resumeQueues();
    await harness.waitFor(() => expect(started).toHaveLength(expected));
    await harness.settle();
  };

  beforeAll(async () => {
    harness = await createPipelineHarness();
    api = await ownerAgent(harness.app as never);
  });

  beforeEach(() => harness.reset());
  afterEach(() => {
    jest.restoreAllMocks();
    return harness.settle();
  });
  afterAll(() => harness.close());

  it("queues the daily run's checks with the scheduled priority", async () => {
    await seedTrackedApp();

    await fanOutDaily();

    const checks = await dailyChecks();
    expect(checks).toHaveLength(2);
    const { priority } = SCHEDULED_JOB_OPTIONS;
    expect(checks.map((job) => job.priority)).toEqual([priority, priority]);
    const counts = await appStoreQueue().getCountsPerPriority([0, priority]);
    expect(counts[0]).toBe(0);
    expect(counts[priority]).toBeGreaterThanOrEqual(2);
  });

  it('queues a check a person started without a priority', async () => {
    const { app, keywords } = await seedTrackedApp();
    await fanOutDaily();

    await api.post(`/apps/${app.id}/run-daily`).expect(202);

    const manual = await appStoreQueue().getJob(
      checkJobId(keywords[0].id, utcDateKey()),
    );
    expect(manual?.priority).toBe(0);
  });

  it("runs a check a person started before the daily run's checks", async () => {
    const { app } = await seedTrackedApp();
    await fanOutDaily();
    await api.post(`/apps/${app.id}/run-daily`).expect(202);
    const queued = await harness.allJobs(QUEUES.APP_STORE);
    const started = recordStarts();

    await runUntilIdle(started, queued.length);

    const manual = started.filter((jobId) => !isDaily(jobId));
    const daily = started.filter(isDaily);
    expect(manual.length).toBeGreaterThan(0);
    expect(daily.length).toBeGreaterThan(0);
    expect(started).toEqual([...manual, ...daily]);
  });

  it('runs deferred work after the daily run', async () => {
    const { keywords } = await seedTrackedApp();
    await appStoreQueue().add(
      JOBS.CHECK_KEYWORD,
      { keywordId: keywords[0].id },
      { ...DEFERRED_JOB_OPTIONS, jobId: 'deferred~probe' },
    );
    await fanOutDaily();
    const queued = await harness.allJobs(QUEUES.APP_STORE);
    const started = recordStarts();

    await runUntilIdle(started, queued.length);

    expect(started.at(-1)).toBe('deferred~probe');
    expect(started.filter(isDaily)).toHaveLength(queued.length - 1);
  });

  it('keeps the scheduled priority when a busy pool sends a job back', async () => {
    await seedTrackedApp();
    await fanOutDaily();
    const [check] = await dailyChecks();
    const sentBack: string[] = [];
    harness.storeJobs.handle.mockImplementation(async (job: Job) => {
      if (job.id !== check.id || sentBack.length > 0) return;
      sentBack.push(job.id);
      await appStoreQueue().pause();
      await job.moveToDelayed(Date.now() + 50, job.token);
      throw new DelayedError();
    });

    await harness.resumeQueues();
    await harness.waitFor(() => expect(sentBack).toHaveLength(1));

    await harness.waitFor(async () => {
      const job = await appStoreQueue().getJob(check.id ?? '');
      expect(await job?.getState()).toBe('prioritized');
      expect(job?.priority).toBe(SCHEDULED_JOB_OPTIONS.priority);
    });
  });
});
