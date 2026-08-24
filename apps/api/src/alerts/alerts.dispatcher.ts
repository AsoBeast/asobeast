import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
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
import { MailerService } from './mailer.service';
import { OutboxRow, outboxRows } from './outbox-rows';

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
  ) {}

  async dispatch(payload: AlertPayload): Promise<void> {
    try {
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
      select: { id: true },
    });
    const scope = this.workspace.scopeFor('instant alert delivery');
    await Promise.all(
      webhooks.map((webhook) =>
        this.queue.add(JOBS.DELIVER_ALERT, {
          webhookId: webhook.id,
          payload,
          ...scope,
        }),
      ),
    );
  }

  private async dispatchEmails(payload: AlertPayload): Promise<void> {
    if (!this.mailer.enabled) {
      this.logger.debug(`email disabled, skipping ${payload.event} fan-out`);
      return;
    }
    const alerts = await this.prisma.emailAlert.findMany({
      where: { active: true, events: { has: payload.event } },
      select: { id: true },
    });
    const scope = this.workspace.scopeFor('instant alert delivery');
    await Promise.all(
      alerts.map((alert) =>
        this.queue.add(JOBS.DELIVER_EMAIL, {
          emailAlertId: alert.id,
          payload,
          ...scope,
        }),
      ),
    );
  }
}
