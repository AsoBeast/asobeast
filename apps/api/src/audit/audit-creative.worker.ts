import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { AiRequestError } from '../ai/openai.client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { requireJobScope } from '../jobs/job-workspace';
import { AuditCreativePayload, QUEUES } from '../jobs/jobs.types';
import { AuditAiRunsService } from './audit-ai-runs.service';
import { RUN_UNFINISHED_MESSAGE } from './audit-run-state';

export const AI_WORKER_CONCURRENCY = 2;

class RefusedRunError extends UnrecoverableError {}

const requestedRun = ({ data }: Job<AuditCreativePayload>): Date | null => {
  const requestedAt = new Date(data.requestedAt);
  return Number.isNaN(requestedAt.getTime()) ? null : requestedAt;
};

const ownerMessage = (error: Error): string =>
  error instanceof AiRequestError || error instanceof RefusedRunError
    ? error.message
    : RUN_UNFINISHED_MESSAGE;

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
      const requestedAt = requestedRun(job);
      if (!requestedAt) return;
      if (!(await this.runs.start(job.data.appId, requestedAt))) return;
      try {
        await this.runs.execute(job.data.appId, requestedAt);
      } catch (error) {
        throw error instanceof AiRequestError && !error.retryable
          ? new RefusedRunError(error.message)
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
    const requestedAt = requestedRun(job);
    if (!requestedAt) return;
    const final =
      error instanceof UnrecoverableError ||
      job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!final) return;
    const { appId } = job.data;
    this.logger.warn(
      `creative analysis failed for app ${appId}: ${error.message}`,
    );
    await this.workspace
      .runScope(requireJobScope(job), () =>
        this.runs.fail(appId, requestedAt, ownerMessage(error)),
      )
      .catch((failure: unknown) =>
        this.logger.error(
          `could not record the failed analysis for app ${appId}`,
          failure,
        ),
      );
  }
}
