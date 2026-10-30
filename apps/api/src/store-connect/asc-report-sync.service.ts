import { Injectable, Logger } from '@nestjs/common';
import type { StoreReportRequest } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import { toDateKey } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import type { DiscoveryVariant } from './asc-analytics-api';
import {
  AscRateLimitedError,
  AscRejectedKeyError,
  AscSegmentSizeError,
  isNotFound,
  isSkippableError,
} from './asc-errors';
import { DiscoveryHeaderError, DiscoveryLineError } from './discovery-report';
import { refusalOf } from './asc-http-errors';
import { AscKeywordFieldSync } from './asc-keyword-field-sync.service';
import {
  StoreConnectionService,
  type OpenedConnection,
} from './store-connection.service';
import {
  StoreReportApplier,
  type PendingInstance,
} from './store-report-applier';
import { StoreReportRequester } from './store-report-requester';
import { emptySummary, type SyncSummary } from './store-sync-summary';

const STORE = 'APP_STORE';

export const MAX_INSTANCES_PER_RUN = 200;
export const PARTIAL_SYNC =
  'Apple answered an error for some apps or reports, or sent a report AsoBeast could not read. They are tried again on the next sync.';
export const ADMIN_KEY_NEEDED =
  'This key can download reports but not request them. Connect an Admin key once; a Sales and Reports key can take over afterwards.';

const isLaneFailure = (error: unknown, variant: DiscoveryVariant): boolean =>
  (variant === 'detailed' && !(error instanceof AscRateLimitedError)) ||
  error instanceof AscSegmentSizeError ||
  error instanceof DiscoveryHeaderError ||
  error instanceof DiscoveryLineError ||
  isSkippableError(error);

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const listingWait = (error: unknown): string =>
  isNotFound(error)
    ? 'is gone at Apple and is requested again on the next sync'
    : 'waits for the next sync';

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

@Injectable()
export class AscReportSync {
  private readonly logger = new Logger(AscReportSync.name);
  maxInstancesPerRun = MAX_INSTANCES_PER_RUN;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: StoreConnectionService,
    private readonly requester: StoreReportRequester,
    private readonly applier: StoreReportApplier,
    private readonly keywordFields: AscKeywordFieldSync,
  ) {}

  async run(): Promise<SyncSummary | null> {
    const connection = await this.connections.openAppStore();
    if (!connection || connection.status === 'rejected') return null;
    const summary = emptySummary();
    try {
      const outcome = await this.requester.ensure(connection, STORE);
      summary.apps = outcome.apps;
      summary.failed = outcome.failed;
      try {
        await this.download(connection, summary);
      } catch (error) {
        if (
          error instanceof AscRateLimitedError ||
          error instanceof AscRejectedKeyError
        ) {
          throw error;
        }
        await this.importKeywordFields(summary);
        throw error;
      }
      await this.importKeywordFields(summary);
      await this.connections.markSynced(
        STORE,
        outcome.reportAccess,
        lastErrorOf(outcome.forbidden, summary.failed),
      );
    } catch (error) {
      if (error instanceof AscRejectedKeyError) {
        const reason = refusalOf(error);
        await this.connections.markRejected(STORE, reason);
        throw new UnrecoverableError(reason);
      }
      if (!(error instanceof AscRateLimitedError)) throw error;
      summary.rateLimited = true;
      await this.connections.markSynced(
        STORE,
        connection.reportAccess,
        connection.lastError,
      );
    }
    return summary;
  }

  private async importKeywordFields(summary: SyncSummary): Promise<void> {
    try {
      const fields = await this.keywordFields.run();
      summary.fields = fields.fields;
      summary.fieldsChanged = fields.changed;
    } catch (error) {
      if (error instanceof AscRateLimitedError) {
        summary.rateLimited = true;
        return;
      }
      this.logger.warn(
        `the keyword field import waits for the next sync: ${messageOf(error)}`,
      );
    }
  }

  private async download(
    connection: OpenedConnection,
    summary: SyncSummary,
  ): Promise<void> {
    const pending = await this.pendingInstances(connection, summary);
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
          `report instance ${item.instance.id} waits for the next sync: ${messageOf(error)}`,
        );
      }
    }
    summary.unresolved = [...unresolved].sort();
  }

  private async pendingInstances(
    connection: OpenedConnection,
    summary: SyncSummary,
  ): Promise<PendingInstance[]> {
    const requests = await this.prisma.storeReportRequest.findMany({
      where: { connectionId: connection.id, state: 'requested' },
      orderBy: { accessType: 'desc' },
    });
    const pending: PendingInstance[] = [];
    for (const request of requests) {
      if (!request.remoteId) continue;
      pending.push(
        ...(await this.requestInstances(connection, request, summary)),
      );
    }
    return pending.sort((a, b) =>
      a.instance.processingDate.localeCompare(b.instance.processingDate),
    );
  }

  private async requestInstances(
    connection: OpenedConnection,
    request: RequestRow,
    summary: SyncSummary,
  ): Promise<PendingInstance[]> {
    let standard: PendingInstance[];
    try {
      standard = await this.instancesOf(connection, request, 'standard');
    } catch (error) {
      if (!isLaneFailure(error, 'standard')) throw error;
      summary.failed += 1;
      if (isNotFound(error)) await this.requester.retire(request.id);
      this.logger.warn(
        `report request ${request.id} ${listingWait(error)}: ${messageOf(error)}`,
      );
      return [];
    }
    return [
      ...standard,
      ...(await this.detailedInstancesOf(connection, request)),
    ];
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
        `the detailed report of request ${request.id} is skipped this run: ${messageOf(error)}`,
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
}
