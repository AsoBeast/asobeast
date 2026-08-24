import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import {
  ActionGenerationResult,
  ActionsGenerator,
  emptyActionRun,
  mergeActionRuns,
} from '../actions/actions.generator';
import { ActionsNotifier } from '../actions/actions.notifier';
import { AlertFlushService } from '../alerts/alert-flush.service';
import { AuditService } from '../audit/audit.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { Env } from '../config/env';
import { ProxyPoolMaintenance } from '../store-providers/egress/proxy-pool.maintenance';
import { DailyBudgetService } from './daily-budget.service';
import { DigestDispatcher } from './digest.dispatcher';
import { requireJobScope } from './job-workspace';
import {
  actionsSuppressedKey,
  DailyCompletePayload,
  JOBS,
  LAST_DAILY_RUN_KEY,
  QUEUES,
} from './jobs.types';
import { PipelineService } from './pipeline.service';
import { AccountDeletionService } from '../account/account-deletion.service';
import { RetentionService } from './retention.service';

@Processor(QUEUES.PIPELINE)
export class PipelineWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PipelineWorker.name);

  constructor(
    @InjectQueue(QUEUES.PIPELINE) private readonly pipelineQueue: Queue,
    private readonly config: ConfigService<Env, true>,
    private readonly pipeline: PipelineService,
    private readonly budget: DailyBudgetService,
    private readonly retention: RetentionService,
    private readonly deletion: AccountDeletionService,
    private readonly digest: DigestDispatcher,
    private readonly audit: AuditService,
    private readonly alertFlush: AlertFlushService,
    private readonly actions: ActionsGenerator,
    private readonly actionsNotifier: ActionsNotifier,
    private readonly crossTenant: CrossTenantAccess,
    private readonly workspace: WorkspaceContext,
    private readonly fanOut: WorkspaceFanOut,
    private readonly proxyPool: ProxyPoolMaintenance,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.pipelineQueue.upsertJobScheduler(
      'daily',
      { pattern: this.config.get('CRON_DAILY', { infer: true }), tz: 'UTC' },
      { name: JOBS.DAILY },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'weekly',
      { pattern: this.config.get('CRON_SCORING', { infer: true }), tz: 'UTC' },
      { name: JOBS.SCORING },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'retention',
      {
        pattern: this.config.get('CRON_RETENTION', { infer: true }),
        tz: 'UTC',
      },
      { name: JOBS.RETENTION },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'digest',
      { pattern: this.config.get('CRON_DIGEST', { infer: true }), tz: 'UTC' },
      { name: JOBS.DIGEST },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'audit',
      { pattern: this.config.get('CRON_AUDIT', { infer: true }), tz: 'UTC' },
      { name: JOBS.AUDIT_SNAPSHOT },
    );
    await this.scheduleProxySync();
  }

  private async scheduleProxySync(): Promise<void> {
    if (!this.proxyPool.enabled) {
      await this.pipelineQueue.removeJobScheduler('proxy-sync');
      return;
    }
    await this.pipelineQueue.upsertJobScheduler(
      'proxy-sync',
      { pattern: this.proxyPool.cron, tz: 'UTC' },
      { name: JOBS.PROXY_SYNC },
    );
  }

  async process(job: Job): Promise<void> {
    await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'the scheduled pipeline spans every workspace before scoping to each',
      () => this.dispatch(job),
    );
  }

  private async dispatch(job: Job): Promise<void> {
    if (job.name === JOBS.DAILY) {
      await this.pipeline.fanOutDaily();
      return;
    }
    if (job.name === JOBS.ACTIONS) {
      await this.workspace.runScope(requireJobScope(job), () =>
        this.runActionsForWorkspace(),
      );
      return;
    }
    if (job.name === JOBS.DAILY_COMPLETE) {
      const actions = await this.generateActions();
      const result = await this.alertFlush.flushEveryWorkspace();
      const client = await this.pipelineQueue.getBackend().client;
      await client.set(LAST_DAILY_RUN_KEY, new Date().toISOString());
      const targets = job.data as DailyCompletePayload;
      this.logger.log(
        `daily pipeline complete ${JSON.stringify({
          date: targets.date,
          apps: targets.apps,
          keywords: targets.keywords,
          categories: targets.categories,
          reviews: targets.reviews,
          flushed: result.flushed,
          channels: result.channels,
          notifications: result.notifications,
          actionsOpened: actions?.opened ?? null,
          actionsResolved: actions?.resolved ?? null,
          actionsSuppressed: actions?.suppressedByCap ?? null,
        })}`,
      );
      return;
    }
    if (job.name === JOBS.SCORING) {
      await this.pipeline.fanOutScoring();
      return;
    }
    if (job.name === JOBS.RETENTION) {
      await this.deletion.eraseDue();
      await this.retention.prune();
      return;
    }
    if (job.name === JOBS.DIGEST) {
      await this.digest.run();
      return;
    }
    if (job.name === JOBS.AUDIT_SNAPSHOT) {
      await this.audit.snapshotAll();
      return;
    }
    if (job.name === JOBS.PROXY_SYNC) {
      await this.proxyPool.run();
      return;
    }
    throw new Error(`Unknown pipeline job ${job.name}`);
  }

  private async runActions(): Promise<ActionGenerationResult> {
    const { results, failures } = await this.fanOut.each(
      'the nightly action run covers every workspace',
      () => this.runActionsForWorkspace(),
    );
    const merged = results.reduce(mergeActionRuns, emptyActionRun());
    const failure = workspaceFailure(
      failures,
      'failed to generate its actions',
    );
    if (failure) throw failure;
    return merged;
  }

  private async runActionsForWorkspace(): Promise<ActionGenerationResult> {
    const workspaceId = this.workspace.require('an action run');
    const budget = await this.budget.estimate();
    const result = await this.actions.generateForWorkspace(budget);
    const client = await this.pipelineQueue.getBackend().client;
    await client.set(
      actionsSuppressedKey(workspaceId),
      String(result.suppressedByCap),
    );
    await this.actionsNotifier.notify(result.openedActions);
    return result;
  }

  private async generateActions(): Promise<ActionGenerationResult | null> {
    try {
      return await this.runActions();
    } catch (error) {
      this.logger.error('action generation failed', error);
      return null;
    }
  }
}
