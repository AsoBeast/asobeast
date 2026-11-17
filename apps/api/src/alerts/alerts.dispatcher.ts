import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AlertPayload, WebhookEvent } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AlertAppIdentities } from './alert-app-identities';
import { DELIVERABLE_EMAIL_ALERTS } from './deliverable-email-alerts';
import { InstantDeliveries } from './instant-deliveries';
import { MailerService } from './mailer.service';
import { OutboxRow, outboxRows } from './outbox-rows';

function outboxWrite(row: OutboxRow, settledAt: Date | null) {
  const data = {
    event: row.event,
    appId: row.appId,
    keywordId: row.keywordId,
    payload: row.payload as unknown as Prisma.InputJsonValue,
  };
  if (settledAt === null) {
    return {
      where: { dedupeKey: row.dedupeKey, flushedAt: null, flushId: null },
      data,
    };
  }
  return {
    where: { dedupeKey: row.dedupeKey },
    data: { ...data, flushedAt: settledAt },
  };
}

@Injectable()
export class AlertsDispatcher {
  private readonly logger = new Logger(AlertsDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<Env, true>,
    private readonly workspace: WorkspaceContext,
    private readonly identities: AlertAppIdentities,
    private readonly deliveries: InstantDeliveries,
  ) {}

  async dispatch(raw: AlertPayload): Promise<void> {
    try {
      const payload = await this.identities.attach(raw);
      if (this.batched(payload)) {
        await this.collect(payload, null);
        return;
      }
      await this.recordSettled(payload);
      await this.deliveries.enqueue(payload);
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

  private async recordSettled(payload: AlertPayload): Promise<void> {
    try {
      await this.collect(payload, new Date());
    } catch (error) {
      this.logger.warn(`alert record failed: ${(error as Error).message}`);
    }
  }

  private async collect(
    payload: AlertPayload,
    settledAt: Date | null,
  ): Promise<void> {
    for (const row of outboxRows(payload)) {
      await this.collectRow(row, settledAt);
    }
  }

  private async collectRow(
    row: OutboxRow,
    settledAt: Date | null,
  ): Promise<void> {
    const { where, data } = outboxWrite(row, settledAt);
    const updated = await this.prisma.alertEvent.updateMany({ where, data });
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
}
