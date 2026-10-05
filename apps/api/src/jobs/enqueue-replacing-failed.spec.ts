import { Queue } from 'bullmq';
import { enqueueReplacingFailed } from './enqueue-replacing-failed';

const JOB_ID = 'check~keyword~2026-10-04';
const OPTS = { jobId: JOB_ID, attempts: 3 };
const DATA = { keywordId: 'keyword', correlationId: 'request-one' };
const OTHER_DATA = { keywordId: 'keyword', correlationId: 'request-two' };

function queueHolding(
  existing: { failed: boolean } | undefined,
  removed = 1,
  storedAfterAdd?: object | null,
) {
  const queue = {
    getJob: jest.fn().mockResolvedValueOnce(
      existing && {
        isFailed: jest.fn().mockResolvedValue(existing.failed),
      },
    ),
    remove: jest.fn().mockResolvedValue(removed),
    add: jest.fn().mockImplementation((_name: string, data: object) => {
      const stored = storedAfterAdd === undefined ? data : storedAfterAdd;
      queue.getJob.mockResolvedValue(
        stored && { data: JSON.parse(JSON.stringify(stored)) as object },
      );
      return Promise.resolve(undefined);
    }),
  };
  return queue;
}

const asQueue = (queue: ReturnType<typeof queueHolding>): Queue =>
  queue as unknown as Queue;

describe('enqueueReplacingFailed', () => {
  it('adds a job nothing holds the id of', async () => {
    const queue = queueHolding(undefined);

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(true);

    expect(queue.remove).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith('check-keyword', DATA, OPTS);
  });

  it('removes a failed job before adding its replacement', async () => {
    const queue = queueHolding({ failed: true });

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(true);

    expect(queue.remove).toHaveBeenCalledWith(JOB_ID);
    expect(queue.add).toHaveBeenCalledWith('check-keyword', DATA, OPTS);
    expect(queue.remove.mock.invocationCallOrder[0]).toBeLessThan(
      queue.add.mock.invocationCallOrder[0],
    );
  });

  it('adds nothing when the failed job cannot be removed', async () => {
    const queue = queueHolding({ failed: true }, 0);

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(false);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('leaves a job that has not failed alone', async () => {
    const queue = queueHolding({ failed: false });

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(false);

    expect(queue.remove).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not count a job another request added first', async () => {
    const queue = queueHolding(undefined, 1, OTHER_DATA);

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(false);

    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('does not count a failed job another request replaced first', async () => {
    const queue = queueHolding({ failed: true }, 1, OTHER_DATA);

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(false);
  });

  it('does not count a job that is gone when it reads it back', async () => {
    const queue = queueHolding(undefined, 1, null);

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(false);
  });

  it('does not count its replacement when another request removed it', async () => {
    const queue = queueHolding({ failed: true }, 1, null);

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(false);
  });

  it('does not count a job another request with its correlation id added', async () => {
    const queue = queueHolding(undefined, 1, DATA);

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', DATA, OPTS),
    ).resolves.toBe(false);
  });

  it('compares the job as the queue stored it', async () => {
    const queue = queueHolding(undefined);
    const data = { keywordId: 'keyword', correlationId: undefined };

    await expect(
      enqueueReplacingFailed(asQueue(queue), 'check-keyword', data, OPTS),
    ).resolves.toBe(true);
  });
});
