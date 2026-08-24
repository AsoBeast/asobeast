import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { Env } from '../config/env';
import { JOBS, QUEUES, type BillingEventPayload } from '../jobs/jobs.types';
import { BillingReconciler } from './billing-reconciler.service';
import { BillingWebhookService } from './billing-webhook.service';
import { DowngradeWarner } from './downgrade-warner.service';
import { TrialNotifier } from './trial-notifier.service';

@Processor(QUEUES.BILLING, { concurrency: 1 })
export class BillingWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(BillingWorker.name);

  constructor(
    @InjectQueue(QUEUES.BILLING) private readonly queue: Queue,
    private readonly webhook: BillingWebhookService,
    private readonly reconciler: BillingReconciler,
    private readonly trials: TrialNotifier,
    private readonly downgrades: DowngradeWarner,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'billing-reconcile',
      {
        pattern: this.config.get('CRON_BILLING_RECONCILE', { infer: true }),
        tz: 'UTC',
      },
      { name: JOBS.BILLING_RECONCILE },
    );
    await this.queue.upsertJobScheduler(
      'trial-notices',
      {
        pattern: this.config.get('CRON_TRIAL_NOTICES', { infer: true }),
        tz: 'UTC',
      },
      { name: JOBS.TRIAL_NOTICES },
    );
  }

  async process(job: Job<BillingEventPayload>): Promise<void> {
    if (job.name === JOBS.BILLING_RECONCILE) {
      await this.reconciler.reconcile();
      return;
    }
    if (job.name === JOBS.TRIAL_NOTICES) {
      await this.trials.sweep();
      await this.downgrades.sweep();
      return;
    }
    await this.webhook.process(job.data.eventId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<BillingEventPayload> | undefined, error: Error): void {
    this.logger.error(`billing job ${job?.name ?? 'unknown'} failed`, error);
  }
}
