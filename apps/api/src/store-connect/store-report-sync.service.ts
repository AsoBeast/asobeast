import { Injectable, Logger } from '@nestjs/common';
import type { StoreReportRequest } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import type { Store } from '@asobeast/shared';
import { toDateKey } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import type { DiscoveryVariant } from './asc-analytics-api';
import {
  AscError,
  AscRateLimitedError,
  AscRejectedKeyError,
  AscSegmentSizeError,
  AscUnreachableError,
} from './asc-errors';
import { DiscoveryHeaderError, DiscoveryLineError } from './discovery-report';
import { refusalOf } from './asc-http-errors';
import {
  StoreConnectionService,
  type OpenedConnection,
} from './store-connection.service';
import {
  StoreReportApplier,
  type PendingInstance,
} from './store-report-applier';
import { StoreReportRequester } from './store-report-requester';

export const MAX_INSTANCES_PER_RUN = 200;
export const PARTIAL_SYNC =
  'Apple answered an error for some apps or reports, or sent a report AsoBeast could not read. They are tried again on the next sync.';
export const ADMIN_KEY_NEEDED =
  'This key can download reports but not request them. Connect an Admin key once; a Sales and Reports key can take over afterwards.';

const isLaneFailure = (error: unknown, variant: DiscoveryVariant): boolean =>
  (variant === 'detailed' && !(error instanceof AscRateLimitedError)) ||
  error instanceof AscSegmentSizeError ||
  error instanceof AscUnreachableError ||
  error instanceof DiscoveryHeaderError ||
  error instanceof DiscoveryLineError ||
  (error instanceof AscError &&
    !(error instanceof AscRejectedKeyError) &&
    !(error instanceof AscRateLimitedError));

const lastErrorOf = (forbidden: boolean, failed: number): string | null =>
  forbidden ? ADMIN_KEY_NEEDED : failed > 0 ? PARTIAL_SYNC : null;

const VARIANT_COLUMNS = {
  standard: { report: 'reportId', processed: 'lastProcessingDate' },
  detailed: {
    report: 'detailedReportId',
    processed: 'detailedLastProcessingDate',
  },
} as const satisfies Record<DiscoveryVariant, object>;

type RequestRow = Pick<
  StoreReportRequest,
  | 'id'
  | 'appId'
  | 'remoteId'
  | 'reportId'
  | 'lastProcessingDate'
  | 'detailedReportId'
  | 'detailedLastProcessingDate'
>;

export interface SyncSummary {
  apps: number;
  instances: number;
  rows: number;
  rateLimited: boolean;
  failed: number;
  unresolved: string[];
}

@Injectable()
export class StoreReportSyncService {
  private readonly logger = new Logger(StoreReportSyncService.name);
  maxInstancesPerRun = MAX_INSTANCES_PER_RUN;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: StoreConnectionService,
    private readonly requester: StoreReportRequester,
    private readonly applier: StoreReportApplier,
  ) {}

  async run(store: Store): Promise<SyncSummary | null> {
    const connection =
      store === 'APP_STORE' ? await this.connections.openAppStore() : null;
    if (!connection || connection.status === 'rejected') return null;
    const summary: SyncSummary = {
      apps: 0,
      instances: 0,
      rows: 0,
      rateLimited: false,
      failed: 0,
      unresolved: [],
    };
    try {
      const outcome = await this.requester.ensure(connection, store);
      summary.apps = outcome.apps;
      summary.failed = outcome.failed;
      await this.download(connection, summary);
      await this.connections.markSynced(
        store,
        outcome.reportAccess,
        lastErrorOf(outcome.forbidden, summary.failed),
      );
    } catch (error) {
      if (error instanceof AscRejectedKeyError) {
        const reason = refusalOf(error);
        await this.connections.markRejected(store, reason);
        throw new UnrecoverableError(reason);
      }
      if (!(error instanceof AscRateLimitedError)) throw error;
      summary.rateLimited = true;
      await this.connections.markSynced(
        store,
        connection.reportAccess,
        connection.lastError,
      );
    }
    this.report(store, summary);
    return summary;
  }

  private async download(
    connection: OpenedConnection,
    summary: SyncSummary,
  ): Promise<void> {
    const pending = await this.pendingInstances(connection);
    const blocked = new Set<string>();
    const unresolved = new Set<string>();
    for (const item of pending.slice(0, this.maxInstancesPerRun)) {
      const lane = `${item.requestId}|${item.variant}`;
      if (blocked.has(lane)) continue;
      try {
        const applied = await this.applier.apply(connection.api, item);
        summary.instances += 1;
        summary.rows += applied.rows;
        applied.unresolved.forEach((territory) => unresolved.add(territory));
      } catch (error) {
        if (!isLaneFailure(error, item.variant)) throw error;
        blocked.add(lane);
        if (!(error instanceof AscSegmentSizeError)) summary.failed += 1;
        this.logger.warn(
          `report instance ${item.instance.id} waits for the next sync: ${(error as Error).message}`,
        );
      }
    }
    summary.unresolved = [...unresolved].sort();
  }

  private async pendingInstances(
    connection: OpenedConnection,
  ): Promise<PendingInstance[]> {
    const requests = await this.prisma.storeReportRequest.findMany({
      where: { connectionId: connection.id, state: 'requested' },
      orderBy: { accessType: 'desc' },
    });
    const pending: PendingInstance[] = [];
    for (const request of requests) {
      if (!request.remoteId) continue;
      pending.push(
        ...(await this.instancesOf(connection, request, 'standard')),
        ...(await this.detailedInstancesOf(connection, request)),
      );
    }
    return pending.sort((a, b) =>
      a.instance.processingDate.localeCompare(b.instance.processingDate),
    );
  }

  private async detailedInstancesOf(
    connection: OpenedConnection,
    request: RequestRow,
  ): Promise<PendingInstance[]> {
    try {
      return await this.instancesOf(connection, request, 'detailed');
    } catch (error) {
      if (error instanceof AscRateLimitedError) throw error;
      this.logger.warn(
        `the detailed report of request ${request.id} is skipped this run: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private async instancesOf(
    connection: OpenedConnection,
    request: RequestRow,
    variant: DiscoveryVariant,
  ): Promise<PendingInstance[]> {
    const { report, processed } = VARIANT_COLUMNS[variant];
    const reportId =
      request[report] ?? (await this.findReport(connection, request, variant));
    if (!reportId) return [];
    const last = request[processed];
    const instances = await connection.api.dailyInstances(
      reportId,
      last ? toDateKey(last) : null,
    );
    return instances.map((instance) => ({
      requestId: request.id,
      appId: request.appId,
      variant,
      instance,
    }));
  }

  private async findReport(
    connection: OpenedConnection,
    request: RequestRow,
    variant: DiscoveryVariant,
  ): Promise<string | null> {
    const found = await connection.api.discoveryReport(
      request.remoteId ?? '',
      variant,
    );
    if (!found) return null;
    await this.prisma.storeReportRequest.update({
      where: { id: request.id },
      data: { [VARIANT_COLUMNS[variant].report]: found.id },
    });
    return found.id;
  }

  private report(store: Store, summary: SyncSummary): void {
    this.logger.log(`store report sync ${store} ${JSON.stringify(summary)}`);
  }
}
