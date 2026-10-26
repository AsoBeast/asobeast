import { Injectable, Logger } from '@nestjs/common';
import type {
  Store,
  StoreReportAccess,
  StoreReportState,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AscAccessType,
  AscAnalyticsApi,
  AscReportRequest,
} from './asc-analytics-api';
import {
  AscForbiddenError,
  isConflict,
  isNotFound,
  isSkippableError,
} from './asc-errors';
import type { OpenedConnection } from './store-connection.service';

export const ACCESS_TYPES: readonly AscAccessType[] = [
  'ONE_TIME_SNAPSHOT',
  'ONGOING',
];

export interface RequestOutcome {
  apps: number;
  reportAccess: StoreReportAccess;
  forbidden: boolean;
  failed: number;
}

interface PrimaryApp {
  id: string;
  storeAppId: string;
}

interface Placement {
  state: StoreReportState;
  remoteId: string | null;
}

interface RequestedRow {
  accessType: string;
  remoteId: string | null;
}

const placementColumns = ({ state, remoteId }: Placement) => ({
  state,
  remoteId,
  reportId: null,
  lastProcessingDate: null,
  detailedReportId: null,
  detailedLastProcessingDate: null,
});

function inPlace(
  type: AscAccessType,
  requested: RequestedRow[],
  remote: AscReportRequest[] | null,
): boolean {
  const row = requested.find((each) => each.accessType === type);
  if (!row) return false;
  if (type !== 'ONGOING' || !remote) return true;
  return remote.some(
    (request) => request.id === row.remoteId && !request.stoppedDueToInactivity,
  );
}

@Injectable()
export class StoreReportRequester {
  private readonly logger = new Logger(StoreReportRequester.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async ensure(
    connection: OpenedConnection,
    store: Store,
  ): Promise<RequestOutcome> {
    const outcome: RequestOutcome = {
      apps: 0,
      reportAccess: connection.reportAccess,
      forbidden: false,
      failed: 0,
    };
    const apps = await this.prisma.app.findMany({
      where: { store, isCompetitor: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, storeAppId: true },
    });
    if (apps.length === 0) return outcome;
    const visible = new Set(
      (await connection.api.appsById(apps.map((app) => app.storeAppId))).map(
        (app) => app.id,
      ),
    );
    const requested = await this.prisma.storeReportRequest.findMany({
      where: { connectionId: connection.id, state: 'requested' },
      select: { appId: true, accessType: true, remoteId: true },
    });
    for (const app of apps) {
      try {
        await this.ensureApp(
          connection,
          app,
          visible.has(app.storeAppId),
          requested.filter((row) => row.appId === app.id),
          outcome,
        );
      } catch (error) {
        if (!isSkippableError(error)) throw error;
        outcome.failed += 1;
        this.logger.warn(
          `report requests of app ${app.id} wait for the next sync: ${(error as Error).message}`,
        );
      }
    }
    return outcome;
  }

  async retire(requestId: string): Promise<void> {
    await this.prisma.storeReportRequest.update({
      where: { id: requestId },
      data: placementColumns({ state: 'stopped', remoteId: null }),
    });
  }

  private async ensureApp(
    connection: OpenedConnection,
    app: PrimaryApp,
    visible: boolean,
    requested: RequestedRow[],
    outcome: RequestOutcome,
  ): Promise<void> {
    const remote = visible
      ? await this.remoteRequests(connection.api, app.storeAppId)
      : null;
    const missing = ACCESS_TYPES.filter(
      (type) => !inPlace(type, requested, remote),
    );
    if (missing.length === 0) return;
    outcome.apps += 1;
    const placements = visible
      ? await this.place(connection.api, app, missing, remote, outcome)
      : missing.map(() => ({ state: 'unmatched' as const, remoteId: null }));
    for (const [index, type] of missing.entries()) {
      await this.record(connection.id, app.id, type, placements[index]);
    }
  }

  private async place(
    api: AscAnalyticsApi,
    app: PrimaryApp,
    missing: AscAccessType[],
    remote: AscReportRequest[] | null,
    outcome: RequestOutcome,
  ): Promise<Placement[]> {
    if (!remote) {
      return missing.map(() => ({ state: 'unmatched', remoteId: null }));
    }
    const placements: Placement[] = [];
    for (const type of missing) {
      const adopted = remote.find(
        (request) =>
          request.accessType === type && !request.stoppedDueToInactivity,
      );
      if (adopted) {
        placements.push({ state: 'requested', remoteId: adopted.id });
        continue;
      }
      placements.push(
        await this.create(api, app.storeAppId, type, remote, outcome),
      );
    }
    return placements;
  }

  private async create(
    api: AscAnalyticsApi,
    storeAppId: string,
    type: AscAccessType,
    remote: AscReportRequest[],
    outcome: RequestOutcome,
  ): Promise<Placement> {
    try {
      const created = await api.createReportRequest(storeAppId, type);
      outcome.reportAccess = 'admin';
      return { state: 'requested', remoteId: created.id };
    } catch (error) {
      if (isConflict(error)) return { state: 'stopped', remoteId: null };
      if (!(error instanceof AscForbiddenError)) throw error;
      outcome.reportAccess = 'readOnly';
      outcome.forbidden = true;
      const stopped = remote.some((request) => request.accessType === type);
      return { state: stopped ? 'stopped' : 'forbidden', remoteId: null };
    }
  }

  private async remoteRequests(
    api: AscAnalyticsApi,
    storeAppId: string,
  ): Promise<AscReportRequest[] | null> {
    try {
      return await api.reportRequests(storeAppId);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private async record(
    connectionId: string,
    appId: string,
    accessType: AscAccessType,
    placement: Placement,
  ): Promise<void> {
    const reset = placementColumns(placement);
    await this.prisma.storeReportRequest.upsert({
      where: { appId_accessType: { appId, accessType } },
      create: {
        workspaceId: this.workspace.require('a report request'),
        connectionId,
        appId,
        accessType,
        ...reset,
      },
      update: { connectionId, ...reset },
    });
  }
}
