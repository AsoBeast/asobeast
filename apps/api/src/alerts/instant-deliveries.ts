import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
import { AlertPayload } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { ALERT_BACKOFF } from './alert-delivery-flow';
import { confirmDropsWhere } from './confirm-drops';
import { DELIVERABLE_EMAIL_ALERTS } from './deliverable-email-alerts';
import { MailerService } from './mailer.service';
import { subscriptionThreshold, withThreshold } from './rank-threshold';
import { receivesInstant } from './review-routing';

export type InstantChannel = 'webhook' | 'email';

export type InstantJobOptions = (
  channel: InstantChannel,
  subscriptionId: string,
) => JobsOptions;

const IMMEDIATE: InstantJobOptions = () => ({ backoff: ALERT_BACKOFF });

const SUBSCRIPTION_SELECT = {
  id: true,
  events: true,
  reviewScores: true,
  ratingDropTenths: true,
  rankDropThreshold: true,
} as const;

@Injectable()
export class InstantDeliveries {
  private readonly logger = new Logger(InstantDeliveries.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUES.ALERTS)
    private readonly queue: Queue<DeliverAlertPayload | DeliverEmailPayload>,
    private readonly workspace: WorkspaceContext,
  ) {}

  async enqueue(
    payload: AlertPayload,
    options: InstantJobOptions = IMMEDIATE,
  ): Promise<void> {
    await Promise.all([
      this.enqueueWebhooks(payload, options),
      this.enqueueEmails(payload, options),
    ]);
  }

  private instanceThreshold(): number {
    return this.config.get('ALERT_RANK_DROP_THRESHOLD', { infer: true });
  }

  private async enqueueWebhooks(
    payload: AlertPayload,
    options: InstantJobOptions,
  ): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        active: true,
        events: { has: payload.event },
        ...confirmDropsWhere(payload),
      },
      select: SUBSCRIPTION_SELECT,
    });
    const instance = this.instanceThreshold();
    const targets = webhooks.filter((webhook) =>
      receivesInstant(webhook, payload, instance),
    );
    const scope = this.workspace.scopeFor('instant alert delivery');
    await Promise.all(
      targets.map((webhook) =>
        this.queue.add(
          JOBS.DELIVER_ALERT,
          {
            webhookId: webhook.id,
            payload: withThreshold(
              payload,
              subscriptionThreshold(webhook, instance),
            ),
            ...scope,
          },
          options('webhook', webhook.id),
        ),
      ),
    );
  }

  private async enqueueEmails(
    payload: AlertPayload,
    options: InstantJobOptions,
  ): Promise<void> {
    if (!this.mailer.enabled) {
      this.logger.debug(`email disabled, skipping ${payload.event} fan-out`);
      return;
    }
    const alerts = await this.prisma.emailAlert.findMany({
      where: {
        ...DELIVERABLE_EMAIL_ALERTS,
        events: { has: payload.event },
        ...confirmDropsWhere(payload),
      },
      select: SUBSCRIPTION_SELECT,
    });
    const instance = this.instanceThreshold();
    const targets = alerts.filter((alert) =>
      receivesInstant(alert, payload, instance),
    );
    const scope = this.workspace.scopeFor('instant alert delivery');
    await Promise.all(
      targets.map((alert) =>
        this.queue.add(
          JOBS.DELIVER_EMAIL,
          {
            emailAlertId: alert.id,
            payload: withThreshold(
              payload,
              subscriptionThreshold(alert, instance),
            ),
            ...scope,
          },
          options('email', alert.id),
        ),
      ),
    );
  }
}
