import { InjectFlowProducer } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { FlowProducer } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  AlertBatchPayload,
  AlertDeliveryStatus,
  AlertFlushResult,
  GranularAlertPayload,
} from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  WorkspaceFailure,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { Env } from '../config/env';
import { FLOW_PRODUCERS, JOBS } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  assembleBatches,
  BatchSkippedCounts,
  OutboxEvent,
  ResolvedApp,
} from './alert-batch';
import { createDeliveryFlows } from './alert-delivery-flow';
import { MailerService } from './mailer.service';

const APP_SELECT = {
  id: true,
  name: true,
  store: true,
  country: true,
  isCompetitor: true,
  primaryAppId: true,
} as const;

const CLAIM_TRANSACTION_ATTEMPTS = 3;

interface ClaimRow {
  id: string;
  event: string;
  appId: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
  flushedAt: Date | null;
  claimedAt: Date | null;
}

interface ClaimResult {
  flushed: number;
  channels: Set<string>;
  notifications: number;
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

@Injectable()
export class AlertFlushService {
  private readonly logger = new Logger(AlertFlushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<Env, true>,
    @InjectFlowProducer(FLOW_PRODUCERS.ALERT_DELIVERY)
    private readonly flowProducer: FlowProducer,
    private readonly workspace: WorkspaceContext,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  async status(): Promise<AlertDeliveryStatus> {
    const [pending, claimed, lastFlushed] = await Promise.all([
      this.prisma.alertEvent.count({
        where: { flushedAt: null, flushId: null },
      }),
      this.prisma.alertEvent.count({
        where: { flushedAt: null, flushId: { not: null } },
      }),
      this.prisma.alertEvent.findFirst({
        where: { flushedAt: { not: null } },
        orderBy: { flushedAt: 'desc' },
        select: { flushedAt: true },
      }),
    ]);
    return {
      mode: this.config.get('ALERT_DELIVERY', { infer: true }),
      pipelineCron: this.config.get('CRON_DAILY', { infer: true }),
      trigger: 'daily_pipeline_completion',
      lastFlushAt: lastFlushed?.flushedAt?.toISOString() ?? null,
      pending,
      claimed,
    };
  }

  async flushEveryWorkspace(): Promise<AlertFlushResult> {
    const workspaceIds = await this.workspacesAwaitingFlush();
    const totals: AlertFlushResult = {
      flushed: 0,
      channels: 0,
      notifications: 0,
    };
    const failures: WorkspaceFailure[] = [];
    for (const workspaceId of workspaceIds) {
      try {
        const result = await this.workspace.run(workspaceId, async () => {
          const flushed = await this.flush();
          return flushed;
        });
        totals.flushed += result.flushed;
        totals.channels += result.channels;
        totals.notifications += result.notifications;
      } catch (error) {
        failures.push({ workspaceId, error });
      }
    }
    const failure = workspaceFailure(failures, 'failed to flush');
    if (failure) throw failure;
    return totals;
  }

  private workspacesAwaitingFlush(): Promise<string[]> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'the daily flush visits every workspace holding unflushed alerts',
      async () => {
        const rows = await this.prisma.alertEvent.findMany({
          where: { flushedAt: null },
          distinct: ['workspaceId'],
          select: { workspaceId: true },
        });
        return rows.map((row) => row.workspaceId);
      },
    );
  }

  async flush(): Promise<AlertFlushResult> {
    this.workspace.require('an alert flush');
    const claimIds = await this.claimSnapshot();
    const channels = new Set<string>();
    const failures: Error[] = [];
    let flushed = 0;
    let notifications = 0;
    for (const claimId of claimIds) {
      try {
        const claim = await this.processClaim(claimId);
        flushed += claim.flushed;
        notifications += claim.notifications;
        claim.channels.forEach((channel) => channels.add(channel));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(
          new Error(`alert flush claim ${claimId} failed: ${message}`, {
            cause: error,
          }),
        );
      }
    }
    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, 'multiple alert flush claims failed');
    }
    return { flushed, channels: channels.size, notifications };
  }

  private async processClaim(claimId: string): Promise<ClaimResult> {
    const rows = await this.loadClaim(claimId);
    const claimedAt = this.claimedAt(rows, claimId);
    if (rows.every((row) => row.flushedAt !== null)) {
      return { flushed: rows.length, channels: new Set(), notifications: 0 };
    }
    if (rows.some((row) => row.flushedAt !== null)) {
      throw new Error(`alert flush claim ${claimId} is partially completed`);
    }
    const events: OutboxEvent[] = rows.map((row) => ({
      id: row.id,
      event: row.event,
      appId: row.appId,
      payload: row.payload as unknown as GranularAlertPayload,
      createdAt: row.createdAt,
    }));

    const { appById, serpPrimariesByKeyword } = await this.resolve(events);
    const batches = assembleBatches({
      events,
      appById,
      serpPrimariesByKeyword,
      now: claimedAt,
    });

    this.warnSkipped(claimId, batches.skipped);
    const delivery = await this.enqueue(batches, claimId);
    await this.completeClaim(claimId, rows.length);
    return { flushed: rows.length, ...delivery };
  }

  private async claimSnapshot(): Promise<string[]> {
    for (let attempt = 1; attempt <= CLAIM_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.claimSnapshotOnce();
      } catch (error) {
        if (
          !isSerializationConflict(error) ||
          attempt === CLAIM_TRANSACTION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
    return [];
  }

  private claimSnapshotOnce(): Promise<string[]> {
    return this.prisma.withTransaction(
      async (transaction) => {
        const unfinished = await transaction.alertEvent.findMany({
          where: { flushedAt: null, flushId: { not: null } },
          orderBy: [{ claimedAt: 'asc' }, { flushId: 'asc' }],
          select: { flushId: true },
        });
        const claimIds = [
          ...new Set(
            unfinished.flatMap((row) =>
              row.flushId === null ? [] : [row.flushId],
            ),
          ),
        ];
        const flushId = randomUUID();
        const claimed = await transaction.alertEvent.updateMany({
          where: { flushedAt: null, flushId: null },
          data: { flushId, claimedAt: new Date() },
        });
        if (claimed.count > 0) claimIds.push(flushId);
        return claimIds;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async loadClaim(claimId: string): Promise<ClaimRow[]> {
    const rows = await this.prisma.alertEvent.findMany({
      where: { flushId: claimId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        event: true,
        appId: true,
        payload: true,
        createdAt: true,
        flushedAt: true,
        claimedAt: true,
      },
    });
    if (rows.length === 0) {
      throw new Error(`alert flush claim ${claimId} has no rows`);
    }
    return rows;
  }

  private claimedAt(rows: ClaimRow[], claimId: string): Date {
    const timestamps = new Set(
      rows.map((row) => row.claimedAt?.getTime() ?? null),
    );
    if (timestamps.size !== 1 || timestamps.has(null)) {
      throw new Error(`alert flush claim ${claimId} has invalid timestamps`);
    }
    const timestamp = rows[0].claimedAt;
    if (!timestamp) {
      throw new Error(`alert flush claim ${claimId} has invalid timestamps`);
    }
    return timestamp;
  }

  private async completeClaim(
    claimId: string,
    expected: number,
  ): Promise<void> {
    const completed = await this.prisma.alertEvent.updateMany({
      where: { flushId: claimId, flushedAt: null },
      data: { flushedAt: new Date() },
    });
    if (completed.count === expected) return;
    const totalCompleted = await this.prisma.alertEvent.count({
      where: { flushId: claimId, flushedAt: { not: null } },
    });
    if (completed.count === 0 && totalCompleted === expected) return;
    throw new Error(`alert flush claim ${claimId} completion mismatch`);
  }

  private async resolve(events: OutboxEvent[]): Promise<{
    appById: Map<string, ResolvedApp>;
    serpPrimariesByKeyword: Map<string, string[]>;
  }> {
    const appIds = new Set<string>();
    const keywordIds = new Set<string>();
    for (const { appId, payload } of events) {
      if (appId) {
        appIds.add(appId);
      }
      if (payload.event === 'serp.entrant') {
        keywordIds.add(payload.keyword.id);
      }
    }

    const appById = new Map<string, ResolvedApp>();
    const rows = await this.prisma.app.findMany({
      where: { id: { in: [...appIds] } },
      select: APP_SELECT,
    });
    rows.forEach((app) => appById.set(app.id, app));

    const missing = new Set<string>();
    for (const app of rows) {
      if (
        app.isCompetitor &&
        app.primaryAppId &&
        !appById.has(app.primaryAppId)
      ) {
        missing.add(app.primaryAppId);
      }
    }
    if (missing.size > 0) {
      const primaries = await this.prisma.app.findMany({
        where: { id: { in: [...missing] } },
        select: APP_SELECT,
      });
      primaries.forEach((app) => appById.set(app.id, app));
    }

    const serpPrimarySets = new Map<string, Set<string>>();
    if (keywordIds.size > 0) {
      const tracked = await this.prisma.trackedKeyword.findMany({
        where: {
          keywordId: { in: [...keywordIds] },
          active: true,
          app: { isCompetitor: false },
        },
        select: { keywordId: true, app: { select: APP_SELECT } },
      });
      for (const { keywordId, app } of tracked) {
        appById.set(app.id, app);
        const ids = serpPrimarySets.get(keywordId) ?? new Set<string>();
        ids.add(app.id);
        serpPrimarySets.set(keywordId, ids);
      }
    }

    const serpPrimariesByKeyword = new Map<string, string[]>();
    for (const [keywordId, ids] of serpPrimarySets) {
      const apps = [...ids]
        .map((id) => appById.get(id))
        .filter((app): app is ResolvedApp => app !== undefined)
        .sort((left, right) => left.id.localeCompare(right.id));
      serpPrimariesByKeyword.set(
        keywordId,
        apps.map((app) => app.id),
      );
    }

    return { appById, serpPrimariesByKeyword };
  }

  private async enqueue(
    batches: {
      owned: AlertBatchPayload;
      competitors: AlertBatchPayload;
    },
    flushId: string,
  ): Promise<{ channels: Set<string>; notifications: number }> {
    const workspaceId = this.workspace.require('alert delivery');
    const [webhooks, emails] = await Promise.all([
      this.prisma.webhook.findMany({
        where: { active: true },
        select: { id: true, events: true },
      }),
      this.mailer.enabled
        ? this.prisma.emailAlert.findMany({
            where: { active: true },
            select: { id: true, events: true },
          })
        : Promise.resolve([]),
    ]);
    const deliveries = [
      ...webhooks.flatMap((subscription) =>
        createDeliveryFlows({
          batches,
          workspaceId,
          flushId,
          kind: 'webhook',
          subscription,
          jobName: JOBS.DELIVER_ALERT,
        }),
      ),
      ...emails.flatMap((subscription) =>
        createDeliveryFlows({
          batches,
          workspaceId,
          flushId,
          kind: 'email',
          subscription,
          jobName: JOBS.DELIVER_EMAIL,
        }),
      ),
    ];
    if (deliveries.length > 0) {
      await this.flowProducer.addBulk(
        deliveries.map((delivery) => delivery.flow),
      );
    }
    return {
      channels: new Set(deliveries.map(({ channel }) => channel)),
      notifications: deliveries.reduce(
        (count, { flow }) => count + 1 + (flow.children?.length ?? 0),
        0,
      ),
    };
  }

  private warnSkipped(claimId: string, skipped: BatchSkippedCounts): void {
    const counts = Object.fromEntries(
      Object.entries(skipped).filter(([, count]) => count > 0),
    );
    if (Object.keys(counts).length > 0) {
      this.logger.warn({ claimId, skipped: counts }, 'Skipped alert events');
    }
  }
}
