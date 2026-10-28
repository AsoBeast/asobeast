import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { AlertPayload, WebhookEvent } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { AlertAppIdentities } from './alert-app-identities';
import { ALERT_BACKOFF } from './alert-delivery-flow';
import { DELIVERABLE_EMAIL_ALERTS } from './deliverable-email-alerts';
import { MailerService } from './mailer.service';
import { OutboxRow, outboxRows } from './outbox-rows';
import { receivesInstant } from './review-routing';

@Injectable()
export class AlertsDispatcher {
  private readonly logger = new Logger(AlertsDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUES.ALERTS)
    private readonly queue: Queue<DeliverAlertPayload | DeliverEmailPayload>,
    private readonly workspace: WorkspaceContext,
    private readonly identities: AlertAppIdentities,
  ) {}

  async dispatch(raw: AlertPayload): Promise<void> {
    try {
      const payload = await this.identities.attach(raw);
      if (this.batched(payload)) {
        await this.collect(payload);
        return;
      }
      await Promise.all([
        this.dispatchWebhooks(payload),
        this.dispatchEmails(payload),
      ]);
    } catch (error) {
      this.logger.warn(`alert dispatch failed: ${(error as Error).message}`);
    }
  }

  async listensTo(event: WebhookEvent): Promise<boolean> {
    const webhooks = await this.prisma.webhook.count({
      where: { active: true, events: { has: event } },
    });
    if (webhooks > 0) return true;
    if (!this.mailer.enabled) return false;
    const emails = await this.prisma.emailAlert.count({
      where: { ...DELIVERABLE_EMAIL_ALERTS, events: { has: event } },
    });
    return emails > 0;
  }

  private batched(payload: AlertPayload): boolean {
    if (this.config.get('ALERT_DELIVERY', { infer: true }) !== 'batched') {
      return false;
    }
    return (
      payload.event !== 'digest.weekly' && payload.event !== 'alerts.batch'
    );
  }

  private async collect(payload: AlertPayload): Promise<void> {
    for (const row of outboxRows(payload)) {
      await this.collectRow(row);
    }
  }

  private async collectRow(row: OutboxRow): Promise<void> {
    const json = row.payload as unknown as Prisma.InputJsonValue;
    const data = { event: row.event, appId: row.appId, payload: json };
    const where = { dedupeKey: row.dedupeKey, flushedAt: null, flushId: null };
    const updated = await this.prisma.alertEvent.updateMany({
      where,
      data,
    });
    if (updated.count > 0) return;
    try {
      await this.prisma.alertEvent.create({
        data: {
          workspaceId: this.workspace.require('an outbox alert'),
          dedupeKey: row.dedupeKey,
          ...data,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      await this.prisma.alertEvent.updateMany({ where, data });
    }
  }

  private async dispatchWebhooks(payload: AlertPayload): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { active: true, events: { has: payload.event } },
      select: { id: true, events: true, reviewScores: true },
    });
    const targets = webhooks.filter((webhook) =>
      receivesInstant(webhook, payload),
    );
    const scope = this.workspace.scopeFor('instant alert delivery');
    await Promise.all(
      targets.map((webhook) =>
        this.queue.add(
          JOBS.DELIVER_ALERT,
          {
            webhookId: webhook.id,
            payload,
            ...scope,
          },
          { backoff: ALERT_BACKOFF },
        ),
      ),
    );
  }

  private async dispatchEmails(payload: AlertPayload): Promise<void> {
    if (!this.mailer.enabled) {
      this.logger.debug(`email disabled, skipping ${payload.event} fan-out`);
      return;
    }
    const alerts = await this.prisma.emailAlert.findMany({
      where: { ...DELIVERABLE_EMAIL_ALERTS, events: { has: payload.event } },
      select: { id: true, events: true, reviewScores: true },
    });
    const targets = alerts.filter((alert) => receivesInstant(alert, payload));
    const scope = this.workspace.scopeFor('instant alert delivery');
    await Promise.all(
      targets.map((alert) =>
        this.queue.add(
          JOBS.DELIVER_EMAIL,
          {
            emailAlertId: alert.id,
            payload,
            ...scope,
          },
          { backoff: ALERT_BACKOFF },
        ),
      ),
    );
  }
}
