import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuditAiRunResult } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  auditCreativeDeduplicationId,
  AuditCreativePayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { JOB_OPTIONS } from '../jobs/job-options';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
import { AuditService } from './audit.service';
import {
  CREATIVE_PROMPT_VERSION,
  creativeFingerprint,
} from './creative/creative-observations';
import {
  ACTIVE_STATES,
  COMPETITOR_RUN_MESSAGE,
  CREATIVE_RUN_ATTEMPTS,
  CREATIVE_RUN_BACKOFF_MS,
  effectiveRun,
  expired,
  isActive,
  NOTHING_TO_ANALYZE_MESSAGE,
  RUN_NOT_QUEUED_MESSAGE,
} from './audit-run-state';

export {
  CREATIVE_RUN_ATTEMPTS,
  CREATIVE_RUN_BACKOFF_MS,
  CREATIVE_RUN_TIMEOUT_MS,
  RUN_UNFINISHED_MESSAGE,
  effectiveRun,
} from './audit-run-state';

@Injectable()
export class AuditAiRunsService {
  private readonly logger = new Logger(AuditAiRunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: AuditContextLoader,
    private readonly auditAi: AuditAiService,
    private readonly audit: AuditService,
    private readonly workspace: WorkspaceContext,
    @InjectQueue(QUEUES.AI) private readonly queue: Queue,
  ) {}

  async request(appId: string): Promise<AuditAiRunResult> {
    const app = await this.loader.app(appId);
    if (app.isCompetitor) {
      throw new UnprocessableEntityException(COMPETITOR_RUN_MESSAGE);
    }
    const model = this.auditAi.model;
    if (model === null) {
      throw new ConflictException('AI features require OPENAI_API_KEY');
    }
    const inputs = await this.loader.creativeInputs(appId);
    if (inputs.iconUrl === null && inputs.screenshotUrls.length === 0) {
      throw new UnprocessableEntityException(NOTHING_TO_ANALYZE_MESSAGE);
    }

    const fingerprint = creativeFingerprint(inputs, model);
    const now = new Date();
    const stored = await this.prisma.auditInsight.findUnique({
      where: { appId },
      select: {
        runState: true,
        runError: true,
        requestedAt: true,
        generatedAt: true,
        inputHash: true,
      },
    });

    if (stored?.runState === 'completed' && stored.inputHash === fingerprint) {
      return { ...effectiveRun(stored, now), reused: true };
    }
    if (stored && isActive(stored.runState) && !expired(stored, now)) {
      return { ...effectiveRun(stored, now), reused: false };
    }

    const queued = { runState: 'queued', requestedAt: now, runError: null };
    await this.prisma.auditInsight.upsert({
      where: { appId },
      create: { appId, model, ...queued },
      update: queued,
    });
    const payload: AuditCreativePayload = {
      ...this.workspace.scopeFor('a creative analysis run'),
      appId,
      requestedAt: now.toISOString(),
    };
    try {
      await this.queue.add(JOBS.AUDIT_CREATIVE, payload, {
        ...JOB_OPTIONS,
        attempts: CREATIVE_RUN_ATTEMPTS,
        backoff: { type: 'exponential', delay: CREATIVE_RUN_BACKOFF_MS },
        deduplication: { id: auditCreativeDeduplicationId(appId, now) },
      });
    } catch (error) {
      await this.failUnqueued(appId, now);
      throw error;
    }

    return {
      state: 'queued',
      requestedAt: now.toISOString(),
      finishedAt: null,
      error: null,
      reused: false,
    };
  }

  async start(appId: string, requestedAt: Date): Promise<boolean> {
    const { count } = await this.prisma.auditInsight.updateMany({
      where: activeRun(appId, requestedAt),
      data: { runState: 'running' },
    });
    return count > 0;
  }

  async execute(appId: string, requestedAt: Date): Promise<void> {
    const inputs = await this.loader.creativeInputs(appId);
    const observations = await this.auditAi.observe(inputs);
    const model = this.auditAi.model ?? 'unknown';
    const { count } = await this.prisma.auditInsight.updateMany({
      where: { appId, requestedAt },
      data: {
        model,
        observations,
        inputHash: creativeFingerprint(inputs, model),
        promptVersion: CREATIVE_PROMPT_VERSION,
        generatedAt: new Date(),
        runState: 'completed',
        runError: null,
      },
    });
    if (count === 0) return;
    await this.audit
      .recordToday(appId)
      .catch((error: unknown) =>
        this.logger.warn(
          `could not record today's audit score for app ${appId}`,
          error,
        ),
      );
  }

  private async failUnqueued(appId: string, requestedAt: Date): Promise<void> {
    await this.prisma.auditInsight
      .updateMany({
        where: { appId, requestedAt, runState: 'queued' },
        data: { runState: 'failed', runError: RUN_NOT_QUEUED_MESSAGE },
      })
      .catch((error: unknown) =>
        this.logger.error(
          `could not release the unqueued analysis for app ${appId}`,
          error,
        ),
      );
  }

  async fail(appId: string, requestedAt: Date, message: string): Promise<void> {
    await this.prisma.auditInsight.updateMany({
      where: activeRun(appId, requestedAt),
      data: { runState: 'failed', runError: message },
    });
  }
}

const activeRun = (appId: string, requestedAt: Date) => ({
  appId,
  requestedAt,
  runState: { in: [...ACTIVE_STATES] },
});
