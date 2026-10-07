import type { Queue } from 'bullmq';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOBS, readScreenshotsJobId } from '../jobs/jobs.types';
import { READ_SCREENSHOTS_JOB_OPTIONS } from '../jobs/job-options';
import { ScreenshotQueue } from './screenshot-queue';

const build = (add = jest.fn().mockResolvedValue(undefined)) => {
  const workspace = {
    scopeFor: jest
      .fn()
      .mockReturnValue({ workspaceId: 'ws_1', correlationId: 'c1' }),
  } as unknown as WorkspaceContext;
  return {
    queue: new ScreenshotQueue({ add } as unknown as Queue, workspace),
    add,
  };
};

describe('ScreenshotQueue.request', () => {
  it('queues one read for the snapshot inside the workspace scope', async () => {
    const { queue, add } = build();

    await queue.request('app_1', 'snap_1');

    expect(add).toHaveBeenCalledWith(
      JOBS.READ_SCREENSHOTS,
      {
        workspaceId: 'ws_1',
        correlationId: 'c1',
        appId: 'app_1',
        snapshotId: 'snap_1',
      },
      {
        ...READ_SCREENSHOTS_JOB_OPTIONS,
        jobId: readScreenshotsJobId('snap_1'),
      },
    );
  });

  it('names the job after the snapshot so a repeat request does not queue twice', () => {
    expect(readScreenshotsJobId('snap_1')).toBe('screenshots~snap_1');
  });

  it('logs and carries on when the queue is unreachable', async () => {
    const { queue } = build(
      jest.fn().mockRejectedValue(new Error('redis down')),
    );

    await expect(queue.request('app_1', 'snap_1')).resolves.toBeUndefined();
  });
});
