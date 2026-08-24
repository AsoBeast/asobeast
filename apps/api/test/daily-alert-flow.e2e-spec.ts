import { getFlowProducerToken } from '@nestjs/bullmq';
import { Store } from '@prisma/client';
import { AlertBatchPayload } from '@asobeast/shared';
import { FlowJob, FlowProducer, Job } from 'bullmq';
import {
  createPipelineHarness,
  type PipelineHarness,
} from './helpers/pipeline-harness';
import {
  dailyCompleteJobId,
  FLOW_PRODUCERS,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../src/jobs/jobs.types';
import { pauseQueues } from './obliterate-queues';

describe('Daily alert flow barrier (e2e)', () => {
  jest.setTimeout(30_000);

  let harness: PipelineHarness;
  let app: PipelineHarness['app'];
  let prisma: PipelineHarness['prisma'];
  let pipeline: PipelineHarness['pipeline'];
  let pipelineWorker: PipelineHarness['pipelineWorker'];
  let storeJobs: PipelineHarness['storeJobs'];
  let webhookDelivery: PipelineHarness['webhookDelivery'];
  let mailer: PipelineHarness['mailer'];
  let queue: PipelineHarness['queue'];
  let allJobs: PipelineHarness['allJobs'];
  let resumeQueues: PipelineHarness['resumeQueues'];
  let waitFor: PipelineHarness['waitFor'];
  let seedApp: PipelineHarness['seedApp'];
  let seedKeyword: PipelineHarness['seedKeyword'];
  let seedAlert: PipelineHarness['seedAlert'];
  let seedWebhook: PipelineHarness['seedWebhook'];

  beforeAll(async () => {
    harness = await createPipelineHarness();
    ({
      app,
      prisma,
      pipeline,
      pipelineWorker,
      storeJobs,
      webhookDelivery,
      mailer,
      queue,
      allJobs,
      resumeQueues,
      waitFor,
      seedApp,
      seedKeyword,
      seedAlert,
      seedWebhook,
    } = harness);
  });

  beforeEach(() => harness.reset());

  afterEach(() => harness.settle());

  afterAll(() => harness.close());

  it('creates one cross-store parent graph without colliding with a manual child', async () => {
    const primary = await seedApp(Store.APP_STORE, 'apple-primary');
    const competitor = await seedApp(
      Store.GOOGLE_PLAY,
      'gplay-competitor',
      true,
      primary.id,
    );
    await seedKeyword(primary.id, Store.APP_STORE, 'apple-keyword');
    await seedKeyword(competitor.id, Store.GOOGLE_PLAY, 'gplay-keyword');
    await harness.asWorkspace(() => pipeline.fanOutApp(primary.id));

    await harness.asWorkspace(() => pipeline.fanOutDaily());
    const beforeRetry = await Promise.all([
      allJobs(QUEUES.APP_STORE),
      allJobs(QUEUES.GPLAY),
    ]);
    await harness.asWorkspace(() => pipeline.fanOutDaily());
    const afterRetry = await Promise.all([
      allJobs(QUEUES.APP_STORE),
      allJobs(QUEUES.GPLAY),
    ]);

    const date = utcDateKey();
    const root = await queue(QUEUES.PIPELINE).getJob(dailyCompleteJobId(date));
    expect(root).not.toBeUndefined();
    await expect(root?.getState()).resolves.toBe('waiting-children');
    const children = [...afterRetry[0], ...afterRetry[1]].filter((job) =>
      job.id?.startsWith('daily~'),
    );
    expect(children.map((job) => job.queueName)).toEqual(
      expect.arrayContaining([QUEUES.APP_STORE, QUEUES.GPLAY]),
    );
    expect(children.every((job) => job.parent?.id === root?.id)).toBe(true);
    expect(children.every((job) => !job.id?.includes(':'))).toBe(true);
    expect(afterRetry.map((jobs) => jobs.length)).toEqual(
      beforeRetry.map((jobs) => jobs.length),
    );
    const manual = await queue(QUEUES.APP_STORE).getJob(
      `refresh~${primary.id}~${date}`,
    );
    expect(manual?.parent).toBeUndefined();
  });

  it('holds delivery behind active children and delivers owned before competitor batches', async () => {
    const primary = await seedApp(Store.APP_STORE, 'primary');
    const competitor = await seedApp(
      Store.APP_STORE,
      'competitor',
      true,
      primary.id,
    );
    await seedAlert(primary.id, 'owned', 'rank.dropped');
    await seedAlert(competitor.id, 'competitor', 'metadata.changed');
    await seedWebhook();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    storeJobs.handle.mockImplementation((job: Job) =>
      job.name === JOBS.REFRESH_APP &&
      (job.data as { appId?: string }).appId === primary.id
        ? gate
        : Promise.resolve(),
    );

    await expect(queue(QUEUES.PIPELINE).isPaused()).resolves.toBe(true);
    await expect(queue(QUEUES.APP_STORE).isPaused()).resolves.toBe(true);
    await harness.asWorkspace(() => pipeline.fanOutDaily());
    expect(storeJobs.handle).not.toHaveBeenCalled();
    const root = await queue(QUEUES.PIPELINE).getJob(
      dailyCompleteJobId(utcDateKey()),
    );
    await expect(root?.getState()).resolves.toBe('waiting-children');
    await expect(root?.getDependenciesCount()).resolves.toMatchObject({
      processed: 0,
      unprocessed: 3,
    });
    await resumeQueues();
    try {
      await waitFor(async () => {
        const active = (await allJobs(QUEUES.APP_STORE)).find(
          (job) =>
            job.id?.startsWith('daily~') &&
            job.name === JOBS.REFRESH_APP &&
            (job.data as { appId?: string }).appId === primary.id,
        );
        expect(active?.parent?.id).toBe(root?.id);
        expect(await active?.getState()).toBe('active');
      });
      expect(webhookDelivery.send).not.toHaveBeenCalled();
      await expect(root?.getState()).resolves.toBe('waiting-children');
    } finally {
      release?.();
    }
    await waitFor(() => {
      expect(webhookDelivery.send).toHaveBeenCalledTimes(2);
    });
    const scopes = webhookDelivery.send.mock.calls
      .map((call) => call[2])
      .filter(
        (payload): payload is AlertBatchPayload =>
          payload.event === 'alerts.batch',
      )
      .map((payload) => payload.scope);
    expect(scopes).toEqual(['owned_apps', 'competitors']);
    await waitFor(async () => {
      expect(await root?.getState()).toBe('completed');
    });

    const jobIds = (
      await Promise.all([allJobs(QUEUES.APP_STORE), allJobs(QUEUES.GPLAY)])
    ).map((jobs) => jobs.map((job) => job.id).sort());
    await pauseQueues(app);
    await harness.asWorkspace(() => pipeline.fanOutDaily());
    await pipelineWorker.process(root as Job);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(webhookDelivery.send).toHaveBeenCalledTimes(2);
    expect(
      (
        await Promise.all([allJobs(QUEUES.APP_STORE), allJobs(QUEUES.GPLAY)])
      ).map((jobs) => jobs.map((job) => job.id).sort()),
    ).toEqual(jobIds);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('waits through test retries and flushes after a child fails terminally', async () => {
    const primary = await seedApp(Store.APP_STORE, 'failing-primary');
    await seedAlert(primary.id, 'failure-owned', 'rank.dropped');
    await seedWebhook();
    storeJobs.handle.mockImplementation((job: Job) => {
      if (job.name === JOBS.REFRESH_APP) {
        throw new Error('injected store failure');
      }
      return Promise.resolve();
    });
    const producer = app.get<FlowProducer>(
      getFlowProducerToken(FLOW_PRODUCERS.DAILY_PIPELINE),
      { strict: false },
    );
    const originalAdd = producer.add.bind(producer);
    const add = jest
      .spyOn(producer, 'add')
      .mockImplementationOnce((flow: FlowJob, options) =>
        originalAdd(
          {
            ...flow,
            opts: {
              ...flow.opts,
              attempts: 5,
              backoff: { type: 'fixed', delay: 25 },
            },
            children: flow.children?.map((child) => ({
              ...child,
              opts: {
                ...child.opts,
                attempts: 2,
                backoff: { type: 'fixed', delay: 25 },
              },
            })),
          },
          options,
        ),
      );

    try {
      await harness.asWorkspace(() => pipeline.fanOutDaily());
    } finally {
      add.mockRestore();
    }
    const root = await queue(QUEUES.PIPELINE).getJob(
      dailyCompleteJobId(utcDateKey()),
    );
    const rootStateOnSend: (string | undefined)[] = [];
    webhookDelivery.send.mockImplementation(async () => {
      const current = await queue(QUEUES.PIPELINE).getJob(root?.id ?? '');
      rootStateOnSend.push(await current?.getState());
    });
    await resumeQueues();
    await waitFor(async () => {
      const failed = (await allJobs(QUEUES.APP_STORE)).find(
        (job) => job.name === JOBS.REFRESH_APP,
      );
      expect(failed?.attemptsMade).toBeGreaterThanOrEqual(1);
    });
    await waitFor(async () => {
      const failed = (await allJobs(QUEUES.APP_STORE)).find(
        (job) => job.name === JOBS.REFRESH_APP,
      );
      expect(await failed?.getState()).toBe('failed');
      expect(failed?.attemptsMade).toBe(2);
    });
    await waitFor(async () => {
      const current = await queue(QUEUES.PIPELINE).getJob(root?.id ?? '');
      expect(await current?.getState()).toBe('completed');
      expect(
        await prisma.alertEvent.count({ where: { flushedAt: { not: null } } }),
      ).toBe(1);
    });
    await waitFor(async () => {
      const alertJobs = await allJobs(QUEUES.ALERTS);
      expect(alertJobs).toHaveLength(1);
      expect(await alertJobs[0].getState()).toBe('completed');
      expect(webhookDelivery.send).toHaveBeenCalledTimes(1);
    });
    expect(rootStateOnSend).toHaveLength(1);
    expect(['active', 'completed']).toContain(rootStateOnSend[0]);
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
