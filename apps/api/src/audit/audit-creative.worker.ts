import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { AiRequestError } from '../ai/openai.client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { requireJobScope } from '../jobs/job-workspace';
import { AuditCreativePayload, QUEUES } from '../jobs/jobs.types';
import { AuditAiRunsService } from './audit-ai-runs.service';

export const AI_WORKER_CONCURRENCY = 2;

@Processor(QUEUES.AI, { concurrency: AI_WORKER_CONCURRENCY })
export class AuditCreativeWorker extends WorkerHost {
  private readonly logger = new Logger(AuditCreativeWorker.name);

  constructor(
    private readonly runs: AuditAiRunsService,
    private readonly workspace: WorkspaceContext,
  ) {
    super();
  }

  async process(job: Job<AuditCreativePayload>): Promise<void> {
    await this.workspace.runScope(requireJobScope(job), async () => {
      try {
        await this.runs.execute(job.data.appId);
      } catch (error) {
        throw error instanceof AiRequestError && !error.retryable
          ? new UnrecoverableError(error.message)
          : error;
      }
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<AuditCreativePayload> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;
    const final =
      error instanceof UnrecoverableError ||
      job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!final) return;
    this.logger.warn(
      `creative analysis failed for app ${job.data.appId}: ${error.message}`,
    );
    await this.workspace
      .runScope(requireJobScope(job), () =>
        this.runs.fail(job.data.appId, error.message),
      )
      .catch((failure: unknown) =>
        this.logger.error(
          `could not record the failed analysis for app ${job.data.appId}`,
          failure,
        ),
      );
  }
}
