import { Store } from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import { BUSY_POOL_LIMIT_MS } from '../src/jobs/busy-pool';
import { GplayWorker } from '../src/jobs/gplay.worker';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { ErrorTracking } from '../src/observability/error-tracking.service';
import { PoolCapacity } from '../src/store-providers/egress/pool-capacity.service';
import { ProxyPoolUnavailableError } from '../src/store-providers/egress/proxy-pool.service';

const QUEUE = 'busy-pool-e2e';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  db: Number(process.env.REDIS_DB),
};

const busyPool = () =>
  new ProxyPoolUnavailableError(Store.GOOGLE_PLAY, 120_000, 50);

describe('A store job the proxy pool is too busy to serve (e2e)', () => {
  const handle = jest.fn<Promise<void>, [Job]>();
  const capture = jest.fn();
  const storeWorker = new GplayWorker(
    { handle } as unknown as StoreJobsHandler,
    { concurrencyFor: () => Promise.resolve(null) } as unknown as PoolCapacity,
    { capture } as unknown as ErrorTracking,
  );
  let queue: Queue;
  let worker: Worker;

  const settled = async (job: Job): Promise<string> => {
    for (let poll = 0; poll < 100; poll++) {
      const state = await queue.getJobState(job.id ?? '');
      if (state === 'completed' || state === 'failed') return state;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return queue.getJobState(job.id ?? '');
  };

  beforeAll(async () => {
    queue = new Queue(QUEUE, { connection });
    await queue.obliterate({ force: true });
    worker = new Worker(
      QUEUE,
      (job: Job, token?: string) => storeWorker.process(job, token),
      { connection },
    );
    worker.on('failed', (job, error) => storeWorker.onFailed(job, error));
    await worker.waitUntilReady();
  });

  beforeEach(() => {
    handle.mockReset();
    capture.mockReset();
  });

  afterAll(async () => {
    await worker.close(true);
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('goes back to the queue without spending an attempt and runs once the pool frees', async () => {
    handle.mockRejectedValueOnce(busyPool()).mockResolvedValue(undefined);

    const job = await queue.add('score-keyword', {}, { attempts: 1 });

    await expect(settled(job)).resolves.toBe('completed');
    expect(handle).toHaveBeenCalledTimes(2);
    expect(capture).not.toHaveBeenCalled();
  });

  it('fails as before once the job has waited longer than the limit', async () => {
    handle.mockRejectedValue(busyPool());

    const job = await queue.add(
      'score-keyword',
      {},
      { attempts: 1, timestamp: Date.now() - BUSY_POOL_LIMIT_MS },
    );

    await expect(settled(job)).resolves.toBe('failed');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
