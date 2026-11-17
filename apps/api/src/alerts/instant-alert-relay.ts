import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AlertPayload } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  WorkspaceFailure,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { PrismaService } from '../prisma/prisma.service';
import { ALERT_DELIVERY_JOB_OPTIONS } from './alert-delivery-flow';
import { InstantDeliveries, InstantJobOptions } from './instant-deliveries';

export const ALERT_RELAY_EVERY_MS = 15_000;
export const RELAY_BATCH = 100;
export const RELAY_MAX_AGE_MS = 7 * 86_400_000;
export const RELAY_MAX_ATTEMPTS = 20;

interface PendingRelay {
  alertEventId: string;
  createdAt: Date;
  attempts: number;
  alertEvent: { event: string; payload: Prisma.JsonValue };
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const relayJobOptions =
  (alertEventId: string): InstantJobOptions =>
  (channel, subscriptionId) => ({
    ...ALERT_DELIVERY_JOB_OPTIONS,
    jobId: `instant~${alertEventId}~${channel}~${subscriptionId}`,
  });

@Injectable()
export class InstantAlertRelay {
  private readonly logger = new Logger(InstantAlertRelay.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveries: InstantDeliveries,
    private readonly workspace: WorkspaceContext,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  async relayEveryWorkspace(now = new Date()): Promise<number> {
    let workspaceIds: string[];
    try {
      workspaceIds = await this.workspacesAwaitingRelay();
    } catch (error) {
      this.logger.warn(
        `the instant alert relay waits for the next run: ${reasonOf(error)}`,
      );
      return 0;
    }
    let relayed = 0;
    const failures: WorkspaceFailure[] = [];
    for (const workspaceId of workspaceIds) {
      try {
        relayed += await this.workspace.run(workspaceId, () => this.relay(now));
      } catch (error) {
        failures.push({ workspaceId, error });
      }
    }
    const failure = workspaceFailure(
      failures,
      'keeps its instant alerts for the next relay',
    );
    if (failure) this.logger.warn(failure.message);
    return relayed;
  }

  private workspacesAwaitingRelay(): Promise<string[]> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'the instant alert relay visits every workspace holding an undelivered alert',
      async () => {
        const rows = await this.prisma.alertRelay.findMany({
          distinct: ['workspaceId'],
          select: { workspaceId: true },
        });
        return rows.map((row) => row.workspaceId);
      },
    );
  }

  private async relay(now: Date): Promise<number> {
    const pending = await this.prisma.alertRelay.findMany({
      orderBy: [{ createdAt: 'asc' }, { alertEventId: 'asc' }],
      take: RELAY_BATCH,
      select: {
        alertEventId: true,
        createdAt: true,
        attempts: true,
        alertEvent: { select: { event: true, payload: true } },
      },
    });
    let relayed = 0;
    for (const row of pending) {
      try {
        relayed += await this.relayOne(row, now);
      } catch (error) {
        await this.recordFailure(row, error);
      }
    }
    return relayed;
  }

  private async relayOne(row: PendingRelay, now: Date): Promise<number> {
    if (now.getTime() - row.createdAt.getTime() > RELAY_MAX_AGE_MS) {
      this.logger.warn(
        `dropped the ${row.alertEvent.event} alert ${row.alertEventId}, undelivered for more than seven days`,
      );
      await this.settle(row.alertEventId);
      return 0;
    }
    await this.deliveries.enqueue(
      row.alertEvent.payload as unknown as AlertPayload,
      relayJobOptions(row.alertEventId),
    );
    await this.settle(row.alertEventId);
    return 1;
  }

  private async recordFailure(
    row: PendingRelay,
    error: unknown,
  ): Promise<void> {
    if (row.attempts + 1 >= RELAY_MAX_ATTEMPTS) {
      this.logger.error(
        `gave up on the ${row.alertEvent.event} alert ${row.alertEventId} after ${RELAY_MAX_ATTEMPTS} failed relays: ${reasonOf(error)}`,
      );
      await this.settle(row.alertEventId);
      return;
    }
    this.logger.warn(
      `the ${row.alertEvent.event} alert ${row.alertEventId} waits for the next relay: ${reasonOf(error)}`,
    );
    await this.prisma.alertRelay.updateMany({
      where: { alertEventId: row.alertEventId },
      data: { attempts: { increment: 1 } },
    });
  }

  private async settle(alertEventId: string): Promise<void> {
    await this.prisma.alertRelay.deleteMany({ where: { alertEventId } });
  }
}
