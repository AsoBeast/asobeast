import { Injectable, Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { toDateKey } from '../../analytics/analytics.support';
import { WorkspaceContext } from '../../common/tenancy/workspace-context';
import { PrismaService } from '../../prisma/prisma.service';
import type { FunnelRow } from '../discovery-report';
import { StoreConnectionService } from '../store-connection.service';
import { funnelUpserts } from '../store-funnel-rows';
import { bucketMissing, PLAY_REFUSED } from '../store-keys';
import { emptySummary, type SyncSummary } from '../store-sync-summary';
import {
  GcsBucketError,
  GcsRateLimitedError,
  GcsRejectedError,
  PLAY_REPORT_MAX_BYTES,
  storePerformanceObjects,
  type GcsApi,
  type GcsObject,
} from './gcs-api';
import {
  decodeCsv,
  parseCsv,
  pivotCountryFile,
  pivotTrafficFile,
  searchTermsOf,
  type SearchTermRow,
} from './play-store-performance';

const STORE = 'GOOGLE_PLAY';
const ACCESS_TYPE = 'ONGOING';
export const PLAY_MONTHS_IMPORTED = 2;
export const PLAY_GRANULARITY = 'MONTHLY';
export const PLAY_PARTIAL_SYNC =
  'Some store performance files could not be read or were too large. They are tried again on the next sync.';

type Breakdown = 'country' | 'traffic';

interface MonthFile {
  month: string;
  breakdown: Breakdown;
  object: GcsObject;
}

interface Target {
  api: GcsApi;
  requestId: string;
  appId: string;
}

interface Imported {
  rows: FunnelRow[];
  terms: SearchTermRow[];
}

const dateValue = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

export function importedMonths(now: Date, count = PLAY_MONTHS_IMPORTED) {
  return Array.from({ length: count }, (_, back) => {
    const month = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1),
    );
    const key = toDateKey(month);
    return { file: key.slice(0, 7).replace('-', ''), date: key };
  });
}

function monthFiles(
  objects: GcsObject[],
  packageName: string,
  now: Date,
): MonthFile[] {
  return importedMonths(now).flatMap(({ file, date }) => {
    const found = storePerformanceObjects(objects, packageName, file);
    return (
      [
        ['country', found.country],
        ['traffic', found.traffic],
      ] as const
    ).flatMap(([breakdown, object]) =>
      object ? [{ month: date, breakdown, object }] : [],
    );
  });
}

function imported(
  breakdown: Breakdown,
  raw: Buffer,
  processed: string,
): Imported {
  const table = parseCsv(decodeCsv(raw));
  if (breakdown === 'country') {
    return { rows: pivotCountryFile(table, processed), terms: [] };
  }
  return {
    rows: pivotTrafficFile(table, processed),
    terms: searchTermsOf(table),
  };
}

const remoteIdOf = (object: GcsObject): string =>
  `${object.name}#${object.generation}`;

const processedOn = (object: GcsObject): string => {
  const updated = new Date(object.updated);
  return toDateKey(Number.isNaN(updated.getTime()) ? new Date() : updated);
};

@Injectable()
export class PlayReportSync {
  private readonly logger = new Logger(PlayReportSync.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    private readonly connections: StoreConnectionService,
  ) {}

  async run(now = new Date()): Promise<SyncSummary | null> {
    const connection = await this.connections.openPlay();
    if (!connection || connection.status === 'rejected') return null;
    const summary = emptySummary();
    try {
      const apps = await this.prisma.app.findMany({
        where: { store: STORE, isCompetitor: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true, storeAppId: true },
      });
      summary.apps = apps.length;
      for (const app of apps) {
        const objects = await connection.api.listStorePerformance(
          app.storeAppId,
        );
        const requestId = await this.placeRequest(
          connection.id,
          app,
          objects.length > 0,
        );
        const target = { api: connection.api, requestId, appId: app.id };
        for (const file of monthFiles(objects, app.storeAppId, now)) {
          if (file.object.size > PLAY_REPORT_MAX_BYTES) {
            summary.failed += 1;
            this.logger.warn(
              `${file.object.name} is ${file.object.size} bytes, above the ${PLAY_REPORT_MAX_BYTES} byte ceiling, and is skipped`,
            );
            continue;
          }
          await this.importFile(target, file, summary);
        }
      }
      await this.connections.markSynced(
        STORE,
        'admin',
        summary.failed > 0 ? PLAY_PARTIAL_SYNC : null,
      );
    } catch (error) {
      await this.failed(error, connection.api, summary, connection.lastError);
    }
    return summary;
  }

  private async failed(
    error: unknown,
    api: GcsApi,
    summary: SyncSummary,
    lastError: string | null,
  ): Promise<void> {
    const refusal =
      error instanceof GcsRejectedError
        ? PLAY_REFUSED
        : error instanceof GcsBucketError
          ? bucketMissing(api.bucket)
          : null;
    if (refusal) {
      await this.connections.markRejected(STORE, refusal);
      throw new UnrecoverableError(refusal);
    }
    if (!(error instanceof GcsRateLimitedError)) throw error;
    summary.rateLimited = true;
    await this.connections.markSynced(STORE, 'admin', lastError);
  }

  private async placeRequest(
    connectionId: string,
    app: { id: string; storeAppId: string },
    matched: boolean,
  ): Promise<string> {
    const state = matched ? 'requested' : 'unmatched';
    const request = await this.prisma.storeReportRequest.upsert({
      where: { appId_accessType: { appId: app.id, accessType: ACCESS_TYPE } },
      create: {
        workspaceId: this.workspace.require('a play report request'),
        connectionId,
        appId: app.id,
        accessType: ACCESS_TYPE,
        state,
        remoteId: app.storeAppId,
      },
      update: { connectionId, state, remoteId: app.storeAppId },
      select: { id: true },
    });
    return request.id;
  }

  private async importFile(
    { api, requestId, appId }: Target,
    { month, breakdown, object }: MonthFile,
    summary: SyncSummary,
  ): Promise<void> {
    const remoteId = remoteIdOf(object);
    const known = await this.prisma.storeReportInstance.findUnique({
      where: { requestId_remoteId: { requestId, remoteId } },
      select: { appliedAt: true },
    });
    if (known?.appliedAt) {
      summary.unchanged += 1;
      return;
    }
    const raw = await api.download(object.name);
    const processed = processedOn(object);
    const { rows, terms } = imported(breakdown, raw, processed);
    const workspaceId = this.workspace.require('a play report file');
    const processingDate = dateValue(processed);
    await this.prisma.withTransaction(async (tx) => {
      const stored = await tx.storeReportInstance.upsert({
        where: { requestId_remoteId: { requestId, remoteId } },
        create: {
          workspaceId,
          requestId,
          appId,
          remoteId,
          granularity: PLAY_GRANULARITY,
          processingDate,
          raw,
          sizeInBytes: raw.length,
          segments: 1,
        },
        update: { raw, sizeInBytes: raw.length },
      });
      for (const statement of funnelUpserts(workspaceId, appId, rows)) {
        await tx.$executeRaw(statement);
      }
      if (breakdown === 'traffic') {
        await tx.storeFunnelSearchTerm.deleteMany({
          where: { appId, month: dateValue(month) },
        });
        await tx.storeFunnelSearchTerm.createMany({
          data: terms
            .filter((term) => term.month === month)
            .map((term) => ({
              workspaceId,
              appId,
              month: dateValue(term.month),
              term: term.term,
              normalized: term.normalized,
              visitors: term.visitors,
              acquisitions: term.acquisitions,
              generation: object.generation,
            })),
        });
      }
      await tx.storeReportRequest.updateMany({
        where: {
          id: requestId,
          OR: [
            { lastProcessingDate: null },
            { lastProcessingDate: { lt: processingDate } },
          ],
        },
        data: { lastProcessingDate: processingDate },
      });
      await tx.storeReportInstance.update({
        where: { id: stored.id },
        data: { appliedAt: new Date() },
      });
    });
    summary.instances += 1;
    summary.rows += rows.length;
    this.logger.debug(
      `imported ${object.name} generation ${object.generation}: ${rows.length} rows, ${terms.length} search terms`,
    );
  }
}
