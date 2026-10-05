import { Queue } from 'bullmq';
import { enqueueReplacingFailed } from './enqueue-replacing-failed';

const JOB_ID = 'check~keyword~2026-10-04';
const OPTS = { jobId: JOB_ID, attempts: 3 };
const DATA = { keywordId: 'keyword' };

function queueHolding(existing: { failed: boolean } | undefined, removed = 1) {
  return {
    getJob: jest.fn().mockResolvedValue(
      existing && {
        isFailed: jest.fn().mockResolvedValue(existing.failed),
      },
    ),
    remove: jest.fn().mockResolvedValue(removed),
    add: jest.fn().mockResolvedValue(undefined),
  };
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
});
