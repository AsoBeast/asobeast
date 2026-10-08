import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { reportJobFailure } from '../jobs/job-failure';
import { requireJobScope } from '../jobs/job-workspace';
import { QUEUES, ReadScreenshotsPayload } from '../jobs/jobs.types';
import { ErrorTracking } from '../observability/error-tracking.service';
import { ScreenshotReader } from './screenshot-reader';

export const SCREENSHOT_WORKER_CONCURRENCY = 1;

@Processor(QUEUES.SCREENSHOTS, { concurrency: SCREENSHOT_WORKER_CONCURRENCY })
export class ScreenshotsWorker extends WorkerHost {
  private readonly logger = new Logger(ScreenshotsWorker.name);

  constructor(
    private readonly reader: ScreenshotReader,
    private readonly workspace: WorkspaceContext,
    private readonly tracking: ErrorTracking,
  ) {
    super();
  }

  async process(job: Job<ReadScreenshotsPayload>): Promise<void> {
    await this.workspace.runScope(requireJobScope(job), () =>
      this.reader.read(job.data.snapshotId),
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<ReadScreenshotsPayload> | undefined,
    error: Error,
  ): Promise<void> {
    reportJobFailure(this.tracking, job, error);
    if (!job) return;
    const final =
      error instanceof UnrecoverableError ||
      job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!final) return;
    this.logger.warn(
      `screenshot read failed for snapshot ${job.data.snapshotId}: ${error.message}`,
    );
    await this.workspace
      .runScope(requireJobScope(job), () =>
        this.reader.abandon(job.data.snapshotId),
      )
      .catch((failure: unknown) =>
        this.logger.error(
          `could not abandon the screenshots of snapshot ${job.data.snapshotId}`,
          failure,
        ),
      );
  }
}
