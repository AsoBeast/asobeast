import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { AlertPayload } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { outboxRows } from './outbox-rows';

export type AlertBuild = () => Promise<AlertPayload | null>;

@Injectable()
export class AlertOutbox {
  private readonly logger = new Logger(AlertOutbox.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly workspace: WorkspaceContext,
  ) {}

  async record(
    tx: Prisma.TransactionClient,
    subject: string,
    build: AlertBuild,
  ): Promise<void> {
    await tx.$executeRaw`SAVEPOINT alert_outbox`;
    try {
      const payload = await build();
      if (payload) await this.write(tx, payload);
      await tx.$executeRaw`RELEASE SAVEPOINT alert_outbox`;
    } catch (error: unknown) {
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT alert_outbox`;
      this.logger.error(
        `the alert of ${subject} was not recorded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async write(
    tx: Prisma.TransactionClient,
    payload: AlertPayload,
  ): Promise<void> {
    const workspaceId = this.workspace.require('a transition alert');
    const settledAt = this.instant() ? new Date() : null;
    const recorded = await tx.alertEvent.createManyAndReturn({
      data: outboxRows(payload).map((row) => ({
        workspaceId,
        event: row.event,
        appId: row.appId,
        keywordId: row.keywordId,
        dedupeKey: row.dedupeKey,
        payload: row.payload as unknown as Prisma.InputJsonValue,
        flushedAt: settledAt,
      })),
      skipDuplicates: true,
      select: { id: true },
    });
    if (settledAt === null || recorded.length === 0) return;
    await tx.alertRelay.createMany({
      data: recorded.map(({ id }) => ({ alertEventId: id, workspaceId })),
    });
  }

  private instant(): boolean {
    return this.config.get('ALERT_DELIVERY', { infer: true }) === 'instant';
  }
}
