import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job, JobsOptions, Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOB_OPTIONS } from '../jobs/job-options';
import { requireJobScope } from '../jobs/job-workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { reportQueueError } from '../jobs/queue-error-reporter';
import { registerInBackground } from '../jobs/schedule-registration';
import { PrismaService } from '../prisma/prisma.service';
import { RedisOutageLog } from '../redis/redis-outage-log';
import { AlertMail } from './alert-mail';
import { DefaultAlertIntro } from './default-alert-intro';
import { isDeliverable } from './deliverable-email-alerts';
import { ALERT_RELAY_EVERY_MS, InstantAlertRelay } from './instant-alert-relay';
import { MailerService } from './mailer.service';
import { WebhookDelivery, WebhookRateLimitedError } from './webhook-delivery';

export function alertBackoff(
  attemptsMade: number,
  _type?: string,
  error?: Error,
): number {
  if (error instanceof WebhookRateLimitedError) return error.retryAfterMs;
  return JOB_OPTIONS.backoff.delay * 2 ** (attemptsMade - 1);
}

type AlertJob = Job<DeliverAlertPayload | DeliverEmailPayload>;

const DETAIL_MAX = 500;

const RELAY_SCHEDULE_OPTIONS = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: 100,
} satisfies JobsOptions;

@Processor(QUEUES.ALERTS, {
  concurrency: 5,
  settings: { backoffStrategy: alertBackoff },
})
export class AlertsWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AlertsWorker.name);
  private registration: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: WebhookDelivery,
    private readonly mailer: MailerService,
    private readonly workspace: WorkspaceContext,
    private readonly alertMail: AlertMail,
    private readonly intro: DefaultAlertIntro,
    @InjectQueue(QUEUES.ALERTS) private readonly queue: Queue,
    private readonly relay: InstantAlertRelay,
    private readonly outage: RedisOutageLog,
  ) {
    super();
  }

  onModuleInit(): void {
    this.registration = registerInBackground(
      this.queue,
      () => this.registerSchedules(),
      (error) => reportQueueError(error, this.outage, this.logger),
    );
  }

  schedulesRegistered(): Promise<void> {
    return this.registration;
  }

  async registerSchedules(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.RELAY_ALERTS,
      { every: ALERT_RELAY_EVERY_MS },
      { name: JOBS.RELAY_ALERTS, opts: RELAY_SCHEDULE_OPTIONS },
    );
  }

  async process(job: AlertJob): Promise<void> {
    if (job.name === JOBS.RELAY_ALERTS) {
      await this.relay.relayEveryWorkspace();
      return;
    }
    await this.workspace.runScope(requireJobScope(job), () =>
      this.deliver(job),
    );
  }

  private async deliver(job: AlertJob): Promise<void> {
    if (job.name === JOBS.DELIVER_EMAIL) {
      await this.deliverEmail(job as Job<DeliverEmailPayload>);
      return;
    }
    await this.deliverWebhook(job as Job<DeliverAlertPayload>);
  }

  private async deliverWebhook(job: Job<DeliverAlertPayload>): Promise<void> {
    const { webhookId, payload } = job.data;
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      select: { url: true, secret: true },
    });
    if (!webhook) {
      return;
    }
    try {
      await this.delivery.send(webhook.url, webhook.secret, payload);
      await this.record('webhook', { webhookId }, payload.event, job, null);
      this.logger.debug(`delivered ${payload.event} to webhook ${webhookId}`);
    } catch (error) {
      await this.record('webhook', { webhookId }, payload.event, job, error);
      throw error;
    }
  }

  private async deliverEmail(job: Job<DeliverEmailPayload>): Promise<void> {
    const { emailAlertId, payload } = job.data;
    const alert = await this.prisma.emailAlert.findUnique({
      where: { id: emailAlertId },
      select: {
        email: true,
        active: true,
        confirmedAt: true,
        defaultOrigin: true,
      },
    });
    if (!alert || !isDeliverable(alert)) {
      this.logger.debug(
        `skipped ${payload.event} for missing, paused or unconfirmed email alert ${emailAlertId}`,
      );
      return;
    }
    const claimedAt = alert.defaultOrigin
      ? await this.intro.claim(emailAlertId)
      : null;
    try {
      await this.mailer.send(
        await this.alertMail.compose(emailAlertId, alert.email, payload, {
          intro: claimedAt !== null,
        }),
      );
      await this.record('email', { emailAlertId }, payload.event, job, null);
      this.logger.debug(`delivered ${payload.event} to email ${emailAlertId}`);
    } catch (error) {
      if (claimedAt) await this.intro.restore(emailAlertId, claimedAt);
      await this.record('email', { emailAlertId }, payload.event, job, error);
      throw error;
    }
  }

  private async record(
    channel: string,
    ref: { webhookId?: string; emailAlertId?: string },
    event: string,
    job: AlertJob,
    error: unknown,
  ): Promise<void> {
    const data: Prisma.AlertDeliveryUncheckedCreateInput = {
      channel,
      ...ref,
      event,
      status: error ? 'failed' : 'success',
      detail: error ? (error as Error).message.slice(0, DETAIL_MAX) : null,
      attempt: job.attemptsMade + 1,
    };
    try {
      await this.prisma.alertDelivery.create({ data });
    } catch (logError) {
      this.logger.warn(`delivery log failed: ${(logError as Error).message}`);
    }
  }
}
