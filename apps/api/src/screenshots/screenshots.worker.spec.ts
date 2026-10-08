import { Job, UnrecoverableError } from 'bullmq';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JobWorkspaceMissingError } from '../jobs/job-workspace';
import type { ReadScreenshotsPayload } from '../jobs/jobs.types';
import type { ErrorTracking } from '../observability/error-tracking.service';
import type { ScreenshotReader } from './screenshot-reader';
import { ScreenshotsWorker } from './screenshots.worker';

const workspace = {
  runScope: <T>(_scope: unknown, work: () => Promise<T>) => work(),
} as unknown as WorkspaceContext;

const job = (
  overrides: {
    workspaceId?: string;
    attemptsMade?: number;
    attempts?: number;
  } = {},
): Job<ReadScreenshotsPayload> =>
  ({
    name: 'read-screenshots',
    id: '1',
    queueName: 'screenshots',
    data: {
      appId: 'app_1',
      snapshotId: 'snap_1',
      workspaceId: 'workspaceId' in overrides ? overrides.workspaceId : 'ws_1',
    },
    attemptsMade: overrides.attemptsMade ?? 1,
    opts: { attempts: overrides.attempts ?? 4 },
  }) as unknown as Job<ReadScreenshotsPayload>;

const build = () => {
  const read = jest.fn().mockResolvedValue(undefined);
  const abandon = jest.fn().mockResolvedValue(undefined);
  const capture = jest.fn();
  const worker = new ScreenshotsWorker(
    { read, abandon } as unknown as ScreenshotReader,
    workspace,
    { capture } as unknown as ErrorTracking,
  );
  return { worker, read, abandon, capture };
};

describe('ScreenshotsWorker.process', () => {
  it('reads the snapshot the job names', async () => {
    const { worker, read } = build();

    await worker.process(job());

    expect(read).toHaveBeenCalledWith('snap_1');
  });

  it('refuses a job that carries no workspace', async () => {
    const { worker, read } = build();

    await expect(
      worker.process(job({ workspaceId: undefined })),
    ).rejects.toBeInstanceOf(JobWorkspaceMissingError);
    expect(read).not.toHaveBeenCalled();
  });

  it('lets a failed read propagate so the queue retries it', async () => {
    const { worker, read } = build();
    read.mockRejectedValue(new Error('busy'));

    await expect(worker.process(job())).rejects.toThrow('busy');
  });
});

describe('ScreenshotsWorker.onFailed', () => {
  it('leaves the rows pending while attempts remain', async () => {
    const { worker, abandon } = build();

    await worker.onFailed(job({ attemptsMade: 1 }), new Error('busy'));

    expect(abandon).not.toHaveBeenCalled();
  });

  it('abandons the rows on the final attempt', async () => {
    const { worker, abandon } = build();

    await worker.onFailed(job({ attemptsMade: 4 }), new Error('busy'));

    expect(abandon).toHaveBeenCalledWith('snap_1');
  });

  it('abandons the rows at once for an error that retrying cannot fix', async () => {
    const { worker, abandon } = build();

    await worker.onFailed(
      job({ attemptsMade: 1 }),
      new UnrecoverableError('no'),
    );

    expect(abandon).toHaveBeenCalledWith('snap_1');
  });
});
