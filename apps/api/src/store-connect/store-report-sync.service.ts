import { Injectable, Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { Store } from '@asobeast/shared';
import { toDateKey } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  AscRateLimitedError,
  AscRejectedKeyError,
  AscSegmentSizeError,
} from './asc-errors';
import { KEY_REFUSED } from './asc-http-errors';
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
export const ADMIN_KEY_NEEDED =
  'This key can download reports but not request them. Connect an Admin key once; a Sales and Reports key can take over afterwards.';

export interface SyncSummary {
  apps: number;
  instances: number;
  rows: number;
  rateLimited: boolean;
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
    const connection = await this.connections.open(store);
    if (!connection || connection.status === 'rejected') return null;
    const summary: SyncSummary = {
      apps: 0,
      instances: 0,
      rows: 0,
      rateLimited: false,
      unresolved: [],
    };
    try {
      const outcome = await this.requester.ensure(connection, store);
      summary.apps = outcome.apps;
      await this.download(connection, summary);
      await this.connections.markSynced(
        store,
        outcome.reportAccess,
        outcome.forbidden ? ADMIN_KEY_NEEDED : null,
      );
    } catch (error) {
      if (error instanceof AscRejectedKeyError) {
        await this.connections.markRejected(store, KEY_REFUSED);
        throw new UnrecoverableError(KEY_REFUSED);
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
      if (blocked.has(item.requestId)) continue;
      try {
        const applied = await this.applier.apply(connection.api, item);
        summary.instances += 1;
        summary.rows += applied.rows;
        applied.unresolved.forEach((territory) => unresolved.add(territory));
      } catch (error) {
        if (!(error instanceof AscSegmentSizeError)) throw error;
        blocked.add(item.requestId);
        this.logger.warn(
          `report instance ${item.instance.id} arrived incomplete and waits for the next sync: ${error.message}`,
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
      const reportId =
        request.reportId ??
        (await this.findReport(connection, request.id, request.remoteId));
      if (!reportId) continue;
      const after = request.lastProcessingDate
        ? toDateKey(request.lastProcessingDate)
        : null;
      const instances = await connection.api.dailyInstances(reportId, after);
      pending.push(
        ...instances.map((instance) => ({
          requestId: request.id,
          appId: request.appId,
          instance,
        })),
      );
    }
    return pending.sort((a, b) =>
      a.instance.processingDate.localeCompare(b.instance.processingDate),
    );
  }

  private async findReport(
    connection: OpenedConnection,
    requestId: string,
    remoteId: string,
  ): Promise<string | null> {
    const report = await connection.api.discoveryReport(remoteId, 'standard');
    if (!report) return null;
    await this.prisma.storeReportRequest.update({
      where: { id: requestId },
      data: { reportId: report.id },
    });
    return report.id;
  }

  private report(store: Store, summary: SyncSummary): void {
    this.logger.log(`store report sync ${store} ${JSON.stringify(summary)}`);
  }
}
