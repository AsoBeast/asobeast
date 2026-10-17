import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { reportJobFailure } from '../jobs/job-failure';
import { requireJobScope } from '../jobs/job-workspace';
import { QUEUES, type SyncStoreReportsPayload } from '../jobs/jobs.types';
import { ErrorTracking } from '../observability/error-tracking.service';
import { StoreReportSyncService } from './store-report-sync.service';

export const STORE_REPORTS_WORKER_CONCURRENCY = 1;

@Processor(QUEUES.STORE_CONNECT, {
  concurrency: STORE_REPORTS_WORKER_CONCURRENCY,
})
export class StoreReportsWorker extends WorkerHost {
  constructor(
    private readonly sync: StoreReportSyncService,
    private readonly workspace: WorkspaceContext,
    private readonly tracking: ErrorTracking,
  ) {
    super();
  }

  async process(job: Job<SyncStoreReportsPayload>): Promise<void> {
    await this.workspace.runScope(requireJobScope(job), () =>
      this.sync.run(job.data.store),
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SyncStoreReportsPayload> | undefined, error: Error): void {
    reportJobFailure(this.tracking, job, error);
  }
}
