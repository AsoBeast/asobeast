import { Injectable } from '@nestjs/common';
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
import { AscError, AscForbiddenError } from './asc-errors';
import type { OpenedConnection } from './store-connection.service';

export const ACCESS_TYPES: readonly AscAccessType[] = [
  'ONE_TIME_SNAPSHOT',
  'ONGOING',
];
const NOT_FOUND = 404;

export interface RequestOutcome {
  apps: number;
  reportAccess: StoreReportAccess;
  forbidden: boolean;
}

interface PrimaryApp {
  id: string;
  storeAppId: string;
}

interface Placement {
  state: StoreReportState;
  remoteId: string | null;
}

@Injectable()
export class StoreReportRequester {
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
      select: { appId: true, accessType: true },
    });
    for (const app of apps) {
      const missing = ACCESS_TYPES.filter(
        (type) =>
          !requested.some(
            (row) => row.appId === app.id && row.accessType === type,
          ),
      );
      if (missing.length === 0) continue;
      outcome.apps += 1;
      const placements = visible.has(app.storeAppId)
        ? await this.place(connection.api, app, missing, outcome)
        : missing.map(() => ({ state: 'unmatched' as const, remoteId: null }));
      for (const [index, type] of missing.entries()) {
        await this.record(connection.id, app.id, type, placements[index]);
      }
    }
    return outcome;
  }

  private async place(
    api: AscAnalyticsApi,
    app: PrimaryApp,
    missing: AscAccessType[],
    outcome: RequestOutcome,
  ): Promise<Placement[]> {
    const remote = await this.remoteRequests(api, app.storeAppId);
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
      if (error instanceof AscError && error.status === NOT_FOUND) return null;
      throw error;
    }
  }

  private async record(
    connectionId: string,
    appId: string,
    accessType: AscAccessType,
    { state, remoteId }: Placement,
  ): Promise<void> {
    const reset = { state, remoteId, reportId: null, lastProcessingDate: null };
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
