import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { requireJobScope } from '../jobs/job-workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { formatEmail } from './email-format';
import { MailerService } from './mailer.service';
import { WebhookDelivery } from './webhook-delivery';

type AlertJob = Job<DeliverAlertPayload | DeliverEmailPayload>;

const DETAIL_MAX = 500;

@Processor(QUEUES.ALERTS, { concurrency: 5 })
export class AlertsWorker extends WorkerHost {
  private readonly logger = new Logger(AlertsWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: WebhookDelivery,
    private readonly mailer: MailerService,
    private readonly workspace: WorkspaceContext,
  ) {
    super();
  }

  async process(job: AlertJob): Promise<void> {
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
      select: { email: true },
    });
    if (!alert) {
      return;
    }
    const { subject, text, html } = formatEmail(payload);
    try {
      await this.mailer.send(alert.email, subject, text, html);
      await this.record('email', { emailAlertId }, payload.event, job, null);
      this.logger.debug(`delivered ${payload.event} to email ${emailAlertId}`);
    } catch (error) {
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
