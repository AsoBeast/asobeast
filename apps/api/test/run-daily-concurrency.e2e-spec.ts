import { Store } from '@prisma/client';
import { Job, JobsOptions, Queue, UnrecoverableError } from 'bullmq';
import type { RunDailyResult } from '@asobeast/shared';
import {
  createPipelineHarness,
  type PipelineHarness,
} from './helpers/pipeline-harness';
import { ownerAgent } from './helpers/session';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';

type Stage = keyof RunDailyResult['enqueued'];

const total = (results: RunDailyResult[], stage: Stage) =>
  results.reduce((sum, result) => sum + result.enqueued[stage], 0);

type AddJob = (
  this: Queue,
  name: string,
  data: unknown,
  opts?: JobsOptions,
) => Promise<Job>;
type GetJob = (this: Queue, jobId: string) => Promise<Job | undefined>;

interface Signal {
  reached: Promise<void>;
  reach: () => void;
}

function signals() {
  let released = false;
  const known = new Map<string, Signal>();
  const signalFor = (key: string): Signal => {
    const existing = known.get(key);
    if (existing) return existing;
    let reach!: () => void;
    const reached = new Promise<void>((resolve) => {
      reach = resolve;
    });
    const signal = { reached, reach };
    known.set(key, signal);
    if (released) reach();
    return signal;
  };
  return {
    reach: (key: string) => signalFor(key).reach(),
    after: (key: string) => signalFor(key).reached,
    hasReached: (key: string) => known.has(key),
    release: () => {
      released = true;
      known.forEach((signal) => signal.reach());
    },
  };
}

function addEveryJobTogether(requests: number) {
  const add = Reflect.get(Queue.prototype, 'add') as AddJob;
  const gate = signals();
  const arrivals = new Map<string, number>();
  jest.spyOn(Queue.prototype, 'add').mockImplementation(function (
    this: Queue,
    name: string,
    data: unknown,
    opts?: JobsOptions,
  ) {
    const jobId = opts?.jobId ?? name;
    const arrived = (arrivals.get(jobId) ?? 0) + 1;
    arrivals.set(jobId, arrived);
    if (arrived === requests) gate.reach(jobId);
    return gate.after(jobId).then(() => add.call(this, name, data, opts));
  } as never);
  return gate.release;
}

function replaceInTurn(requests: number, requestOf: () => string) {
  const add = Reflect.get(Queue.prototype, 'add') as AddJob;
  const remove = Reflect.get(Queue.prototype, 'remove');
  const getJob = Reflect.get(Queue.prototype, 'getJob') as GetJob;
  const turn = signals();
  const orders = new Map<string, string[]>();
  const step = (jobId: string, request: string, name: string) =>
    `${jobId}|${request}|${name}`;
  const neighbour = (jobId: string, request: string, offset: number) => {
    const order = orders.get(jobId) ?? [];
    return order[order.indexOf(request) + offset];
  };
  const takesTurns = (jobId: string, request: string) =>
    (orders.get(jobId) ?? []).includes(request);

  jest.spyOn(Queue.prototype, 'remove').mockImplementation(async function (
    this: Queue,
    jobId: string,
  ) {
    const request = requestOf();
    const order = orders.get(jobId) ?? [];
    orders.set(jobId, [...order, request]);
    if (order.length + 1 === requests) turn.reach(step(jobId, '*', 'arrived'));
    await turn.after(step(jobId, '*', 'arrived'));
    const previous = neighbour(jobId, request, -1);
    if (previous) await turn.after(step(jobId, previous, 'added'));
    const removed = await remove.call(this, jobId);
    turn.reach(step(jobId, request, 'removed'));
    return removed;
  });

  jest.spyOn(Queue.prototype, 'add').mockImplementation(async function (
    this: Queue,
    name: string,
    data: unknown,
    opts?: JobsOptions,
  ) {
    const request = requestOf();
    const jobId = opts?.jobId;
    if (!jobId || !takesTurns(jobId, request)) {
      return add.call(this, name, data, opts);
    }
    const previous = neighbour(jobId, request, -1);
    if (previous) await turn.after(step(jobId, previous, 'read'));
    const job = await add.call(this, name, data, opts);
    turn.reach(step(jobId, request, 'added'));
    return job;
  } as never);

  jest.spyOn(Queue.prototype, 'getJob').mockImplementation(async function (
    this: Queue,
    jobId: string,
  ) {
    const request = requestOf();
    if (!turn.hasReached(step(jobId, request, 'added'))) {
      return getJob.call(this, jobId);
    }
    const next = neighbour(jobId, request, 1);
    if (next) await turn.after(step(jobId, next, 'removed'));
    const job = await getJob.call(this, jobId);
    turn.reach(step(jobId, request, 'read'));
    return job;
  } as never);

  return turn.release;
}

describe('Run daily under concurrency (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: PipelineHarness;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let workspace: WorkspaceContext;

  const runDaily = async (
    appId: string,
    requestId?: string,
  ): Promise<RunDailyResult> => {
    const request = api.post(`/apps/${appId}/run-daily`);
    const response = await (
      requestId ? request.set('x-request-id', requestId) : request
    ).expect(202);
    return response.body as RunDailyResult;
  };

  const race = (
    appId: string,
    requests: number,
    release: () => void,
    requestId?: string,
  ) =>
    Promise.all(
      Array.from({ length: requests }, () =>
        runDaily(appId, requestId).catch((error: unknown) => {
          release();
          throw error;
        }),
      ),
    );

  const seedTrackedApp = async () => {
    const app = await harness.seedApp(Store.APP_STORE, 'things-3');
    await harness.seedKeyword(app.id, Store.APP_STORE, 'to do');
    await harness.seedKeyword(app.id, Store.APP_STORE, 'task list');
    return app;
  };

  const queued = async (name: string) =>
    (await harness.allJobs(QUEUES.APP_STORE)).filter(
      (job) => job.name === name,
    );

  const failChecks = async (appId: string) => {
    harness.storeJobs.handle.mockImplementation((job: Job) =>
      job.name === JOBS.CHECK_KEYWORD
        ? Promise.reject(new UnrecoverableError('APP_STORE search failed'))
        : Promise.resolve(),
    );
    await runDaily(appId);
    await harness.resumeQueues();
    await harness.waitFor(async () => {
      const checks = await queued(JOBS.CHECK_KEYWORD);
      const states = await Promise.all(checks.map((job) => job.getState()));
      expect(states).toEqual(['failed', 'failed']);
    });
    await harness.settle();
    harness.storeJobs.handle.mockReset().mockResolvedValue(undefined);
  };

  beforeAll(async () => {
    harness = await createPipelineHarness();
    api = await ownerAgent(harness.app as never);
    workspace = harness.app.get(WorkspaceContext);
  });

  beforeEach(() => harness.reset());
  afterEach(() => {
    jest.restoreAllMocks();
    return harness.settle();
  });
  afterAll(() => harness.close());

  it.each([2, 5])(
    'reports each job once when %i requests race',
    async (requests) => {
      const app = await seedTrackedApp();

      const results = await race(
        app.id,
        requests,
        addEveryJobTogether(requests),
      );

      expect(await queued(JOBS.CHECK_KEYWORD)).toHaveLength(2);
      expect(total(results, 'keywords')).toBe(2);
      expect(total(results, 'apps')).toBe(1);
      expect(total(results, 'reviews')).toBe(1);
    },
  );

  it('reports each job once when two requests share a request id', async () => {
    const app = await seedTrackedApp();

    const results = await race(
      app.id,
      2,
      addEveryJobTogether(2),
      'shared-request',
    );

    expect(await queued(JOBS.CHECK_KEYWORD)).toHaveLength(2);
    expect(total(results, 'keywords')).toBe(2);
  });

  it.each([2, 5])(
    'reports each failed job once when %i requests replace it in turn',
    async (requests) => {
      const app = await seedTrackedApp();
      await failChecks(app.id);

      const results = await race(
        app.id,
        requests,
        replaceInTurn(requests, () => workspace.correlationId ?? 'outside'),
      );

      expect(await queued(JOBS.CHECK_KEYWORD)).toHaveLength(2);
      expect(total(results, 'keywords')).toBe(2);
    },
  );
});
