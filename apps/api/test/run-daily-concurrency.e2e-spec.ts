import { Store } from '@prisma/client';
import { Job, JobsOptions, Queue } from 'bullmq';
import type { RunDailyResult } from '@asobeast/shared';
import {
  createPipelineHarness,
  type PipelineHarness,
} from './helpers/pipeline-harness';
import { ownerAgent } from './helpers/session';
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

interface Gate {
  arrived: number;
  opened: Promise<void>;
  open: () => void;
}

function addEveryJobTogether(requests: number) {
  const add = Reflect.get(Queue.prototype, 'add') as AddJob;
  const gates = new Map<string, Gate>();
  const gateFor = (jobId: string): Gate => {
    const known = gates.get(jobId);
    if (known) return known;
    let open!: () => void;
    const opened = new Promise<void>((resolve) => {
      open = resolve;
    });
    const gate = { arrived: 0, opened, open };
    gates.set(jobId, gate);
    return gate;
  };
  return jest.spyOn(Queue.prototype, 'add').mockImplementation(function (
    this: Queue,
    name: string,
    data: unknown,
    opts?: JobsOptions,
  ) {
    const gate = gateFor(opts?.jobId ?? name);
    gate.arrived += 1;
    if (gate.arrived === requests) gate.open();
    return gate.opened.then(() => add.call(this, name, data, opts));
  } as never);
}

describe('Run daily under concurrency (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: PipelineHarness;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const runDaily = async (appId: string): Promise<RunDailyResult> => {
    const response = await api.post(`/apps/${appId}/run-daily`).expect(202);
    return response.body as RunDailyResult;
  };

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

  it.each([2, 5])(
    'reports each job once when %i requests race',
    async (requests) => {
      const app = await seedTrackedApp();
      addEveryJobTogether(requests);

      const results = await Promise.all(
        Array.from({ length: requests }, () => runDaily(app.id)),
      );

      expect(await queued(JOBS.CHECK_KEYWORD)).toHaveLength(2);
      expect(total(results, 'keywords')).toBe(2);
      expect(total(results, 'apps')).toBe(1);
      expect(total(results, 'reviews')).toBe(1);
    },
  );
});
