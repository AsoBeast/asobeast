import { Prisma, Store } from '@prisma/client';
import { Job, UnrecoverableError } from 'bullmq';
import type { RunDailyResult } from '@asobeast/shared';
import {
  createPipelineHarness,
  type PipelineHarness,
} from './helpers/pipeline-harness';
import { ownerAgent } from './helpers/session';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  checkJobId,
  JOBS,
  QUEUES,
  scoreJobId,
  utcDateKey,
} from '../src/jobs/jobs.types';
import { scrapedAppStoreRaw } from '../src/store-providers/app-store-scraped.fixture';

const NOTHING_NEW = { apps: 0, keywords: 0, categories: 0, reviews: 0 };

describe('Run daily after a failed collection (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: PipelineHarness;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const runDaily = async (appId: string): Promise<RunDailyResult> => {
    const response = await api.post(`/apps/${appId}/run-daily`).expect(202);
    return response.body as RunDailyResult;
  };

  const checkJob = (keywordId: string): Promise<Job | undefined> =>
    harness.queue(QUEUES.APP_STORE).getJob(checkJobId(keywordId, utcDateKey()));

  const stateOfCheck = async (keywordId: string): Promise<string> =>
    (await (await checkJob(keywordId))?.getState()) ?? 'missing';

  const failEveryStoreJob = (): void => {
    harness.storeJobs.handle.mockRejectedValue(
      new UnrecoverableError('APP_STORE search failed: fetch failed'),
    );
  };

  const failChecksOnly = (): void => {
    harness.storeJobs.handle.mockImplementation((job: Job) =>
      job.name === JOBS.CHECK_KEYWORD
        ? Promise.reject(new UnrecoverableError('APP_STORE search failed'))
        : Promise.resolve(),
    );
  };

  const recoverStore = (): void => {
    harness.storeJobs.handle.mockReset().mockResolvedValue(undefined);
  };

  const failThenSettle = async (keywordId: string): Promise<void> => {
    await harness.resumeQueues();
    await harness.waitFor(async () => {
      expect(await stateOfCheck(keywordId)).toBe('failed');
    });
    await harness.settle();
  };

  const seedTrackedApp = async () => {
    const app = await harness.seedApp(Store.APP_STORE, 'things-3');
    const keyword = await harness.seedKeyword(app.id, Store.APP_STORE, 'to do');
    return { app, keyword };
  };

  beforeAll(async () => {
    harness = await createPipelineHarness();
    api = await ownerAgent(harness.app as never);
  });

  beforeEach(() => harness.reset());
  afterEach(() => harness.settle());
  afterAll(() => harness.close());

  it('collects the keywords whose check failed earlier today', async () => {
    const { app, keyword } = await seedTrackedApp();
    failEveryStoreJob();
    await runDaily(app.id);
    await failThenSettle(keyword.id);
    recoverStore();

    const second = await runDaily(app.id);
    await harness.resumeQueues();

    await harness.waitFor(async () => {
      expect(await stateOfCheck(keyword.id)).toBe('completed');
    });
    expect(second.enqueued.keywords).toBe(1);
  });

  it('reports only the work it queued again', async () => {
    const { app, keyword } = await seedTrackedApp();
    failChecksOnly();
    await runDaily(app.id);
    await failThenSettle(keyword.id);
    recoverStore();

    const second = await runDaily(app.id);

    expect(second.enqueued).toEqual({ ...NOTHING_NEW, keywords: 1 });
  });

  it('queues a failed chart check again', async () => {
    const { app, keyword } = await seedTrackedApp();
    await harness.prisma.appSnapshot.create({
      data: {
        appId: app.id,
        title: 'Charts',
        description: 'Fixture description',
        raw: (await scrapedAppStoreRaw()) as Prisma.InputJsonObject,
      },
    });
    failEveryStoreJob();
    await runDaily(app.id);
    await failThenSettle(keyword.id);
    recoverStore();

    const second = await runDaily(app.id);
    await harness.resumeQueues();

    expect(second.enqueued.categories).toBe(4);
    await harness.waitFor(async () => {
      const charts = (await harness.allJobs(QUEUES.APP_STORE)).filter(
        (job) => job.name === JOBS.CHECK_CATEGORY,
      );
      const states = await Promise.all(charts.map((job) => job.getState()));
      expect(states).toEqual(Array(4).fill('completed'));
    });
  });

  it('queues the failed work of a whole workspace again', async () => {
    const { keyword } = await seedTrackedApp();
    failEveryStoreJob();
    await harness.asWorkspace(() =>
      harness.pipeline.fanOutWorkspaceDaily(DEFAULT_WORKSPACE_ID),
    );
    await failThenSettle(keyword.id);
    recoverStore();

    await harness.asWorkspace(() =>
      harness.pipeline.fanOutWorkspaceDaily(DEFAULT_WORKSPACE_ID),
    );
    await harness.resumeQueues();

    await harness.waitFor(async () => {
      expect(await stateOfCheck(keyword.id)).toBe('completed');
    });
  });

  it('scores a keyword again when its score job failed today', async () => {
    const { keyword } = await seedTrackedApp();
    const stateOfScore = async (): Promise<string> =>
      (await (
        await harness
          .queue(QUEUES.APP_STORE)
          .getJob(scoreJobId(keyword.id, utcDateKey()))
      )?.getState()) ?? 'missing';
    failEveryStoreJob();
    await api.post(`/keywords/${keyword.id}/score`).expect(202);
    await harness.resumeQueues();
    await harness.waitFor(async () => {
      expect(await stateOfScore()).toBe('failed');
    });
    await harness.settle();
    recoverStore();

    await api.post(`/keywords/${keyword.id}/score`).expect(202);
    await harness.resumeQueues();

    await harness.waitFor(async () => {
      expect(await stateOfScore()).toBe('completed');
    });
  });

  it('does not queue a check that is already waiting', async () => {
    const { app, keyword } = await seedTrackedApp();

    await runDaily(app.id);
    const second = await runDaily(app.id);

    expect(second.enqueued).toEqual(NOTHING_NEW);
    expect(await stateOfCheck(keyword.id)).toBe('waiting');
    const checks = (await harness.allJobs(QUEUES.APP_STORE)).filter(
      (job) => job.name === JOBS.CHECK_KEYWORD,
    );
    expect(checks).toHaveLength(1);
  });

  it('does not queue again what completed today', async () => {
    const { app, keyword } = await seedTrackedApp();
    await runDaily(app.id);
    await harness.resumeQueues();
    await harness.waitFor(async () => {
      expect(await stateOfCheck(keyword.id)).toBe('completed');
    });
    await harness.settle();
    const handled = harness.storeJobs.handle.mock.calls.length;

    const second = await runDaily(app.id);
    await harness.resumeQueues();
    await harness.settle();

    expect(second.enqueued).toEqual(NOTHING_NEW);
    expect(harness.storeJobs.handle.mock.calls).toHaveLength(handled);
  });

  it('leaves a check that is running alone', async () => {
    const { app, keyword } = await seedTrackedApp();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.storeJobs.handle.mockImplementation(async (job: Job) => {
      if (job.name === JOBS.CHECK_KEYWORD) await held;
    });
    await runDaily(app.id);
    await harness.resumeQueues();
    await harness.waitFor(async () => {
      expect(await stateOfCheck(keyword.id)).toBe('active');
    });

    try {
      const second = await runDaily(app.id);
      expect(second.enqueued.keywords).toBe(0);
      expect(await stateOfCheck(keyword.id)).toBe('active');
    } finally {
      release?.();
    }
    await harness.waitFor(async () => {
      expect(await stateOfCheck(keyword.id)).toBe('completed');
    });
  });

  it('answers two simultaneous clicks with one job per check', async () => {
    const { app, keyword } = await seedTrackedApp();
    failEveryStoreJob();
    await runDaily(app.id);
    await failThenSettle(keyword.id);
    recoverStore();

    await Promise.all([runDaily(app.id), runDaily(app.id)]);

    const checks = (await harness.allJobs(QUEUES.APP_STORE)).filter(
      (job) => job.name === JOBS.CHECK_KEYWORD,
    );
    expect(checks).toHaveLength(1);
    expect(['waiting', 'prioritized', 'paused']).toContain(
      await checks[0].getState(),
    );

    await harness.resumeQueues();
    await harness.waitFor(async () => {
      expect(await stateOfCheck(keyword.id)).toBe('completed');
    });
    const handledChecks = harness.storeJobs.handle.mock.calls.filter(
      ([job]) => job.name === JOBS.CHECK_KEYWORD,
    );
    expect(handledChecks).toHaveLength(1);
  });
});
