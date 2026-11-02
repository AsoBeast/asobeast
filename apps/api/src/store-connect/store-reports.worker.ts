import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { isFinalAttempt } from '../jobs/final-attempt';
import { reportJobFailure } from '../jobs/job-failure';
import { requireJobScope } from '../jobs/job-workspace';
import { QUEUES, type SyncStoreReportsPayload } from '../jobs/jobs.types';
import { ErrorTracking } from '../observability/error-tracking.service';
import { StoreReportSyncService } from './store-report-sync.service';

export const STORE_REPORTS_WORKER_CONCURRENCY = 1;

const failureLine = (
  job: Job<SyncStoreReportsPayload> | undefined,
  error: Error,
): string =>
  job
    ? `store report sync ${job.data.store} failed on attempt ${job.attemptsMade} of ${job.opts.attempts ?? 1}: ${error.message}`
    : `store report sync failed: ${error.message}`;

@Processor(QUEUES.STORE_CONNECT, {
  concurrency: STORE_REPORTS_WORKER_CONCURRENCY,
})
export class StoreReportsWorker extends WorkerHost {
  private readonly logger = new Logger(StoreReportsWorker.name);

  constructor(
    private readonly sync: StoreReportSyncService,
    private readonly workspace: WorkspaceContext,
    private readonly tracking: ErrorTracking,
  ) {
    super();
  }

  async process(job: Job<SyncStoreReportsPayload>): Promise<void> {
    await this.workspace.runScope(requireJobScope(job), () =>
      this.sync.run(job.data.store, isFinalAttempt(job)),
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SyncStoreReportsPayload> | undefined, error: Error): void {
    this.logger.warn(failureLine(job, error));
    reportJobFailure(this.tracking, job, error);
  }
}
