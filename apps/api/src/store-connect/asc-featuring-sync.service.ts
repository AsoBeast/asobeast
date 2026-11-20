import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  FIELD_SYNC_NO_LIVE_VERSION,
  FIELD_SYNC_UNSERVED_APP,
} from './asc-keyword-field-sync.service';
import type {
  AscListingApi,
  AscNomination,
  AscNominationState,
} from './asc-listing-api';
import {
  AscError,
  AscForbiddenError,
  AscRateLimitedError,
  isNotFound,
} from './asc-errors';
import {
  StoreConnectionService,
  type OpenedConnection,
} from './store-connection.service';

const STORE = Store.APP_STORE;

export const FEATURING_ROLE_NEEDED =
  'This App Store Connect key cannot read featuring nominations. Connect a key with the Admin or App Manager role.';

const NOMINATION_STATES: readonly AscNominationState[] = ['DRAFT', 'SUBMITTED'];

const NOMINATION_COUNT_OF: Record<AscNominationState, 'draft' | 'submitted'> = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
};

export interface FeaturingSyncSummary {
  nominations: number;
  promoText: number;
}

interface SyncApp {
  id: string;
  storeAppId: string;
}

interface PromoCounts {
  filled: number;
  total: number;
}

interface NominationCounts {
  draft: number;
  submitted: number;
  submittedDate: Date | null;
  publishStartDate: Date | null;
  publishEndDate: Date | null;
}

type PromoRead =
  { kind: 'ok'; counts: PromoCounts } | { kind: 'skipped'; message: string };

type NominationsRead =
  | { kind: 'ok'; counts: NominationCounts }
  | { kind: 'refused'; message: string }
  | { kind: 'skipped'; message: string };

type LiveVersionRead =
  | { kind: 'live'; id: string }
  | { kind: 'invisible' }
  | { kind: 'noRelease' }
  | { kind: 'failed'; message: string };

interface AppOutcome {
  nominations: number;
  promoText: number;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const emptyCounts = (): NominationCounts => ({
  draft: 0,
  submitted: 0,
  submittedDate: null,
  publishStartDate: null,
  publishEndDate: null,
});

const submittedAtOf = (nomination: AscNomination): number =>
  nomination.submittedDate === null
    ? 0
    : Date.parse(nomination.submittedDate) || 0;

const newestSubmitted = (nominations: AscNomination[]): AscNomination | null =>
  nominations
    .filter((nomination) => nomination.state === 'SUBMITTED')
    .sort((left, right) => submittedAtOf(right) - submittedAtOf(left))[0] ??
  null;

const asDate = (value: string | null): Date | null => {
  const parsed = value === null ? NaN : Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
};

const nominationData = (counts: NominationCounts) => ({
  draftNominations: counts.draft,
  submittedNominations: counts.submitted,
  submittedDate: counts.submittedDate,
  publishStartDate: counts.publishStartDate,
  publishEndDate: counts.publishEndDate,
});

const nominationsErrorOf = (read: NominationsRead): string | null =>
  read.kind === 'ok' ? null : read.message;

@Injectable()
export class AscFeaturingSync {
  private readonly logger = new Logger(AscFeaturingSync.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: StoreConnectionService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async run(): Promise<FeaturingSyncSummary> {
    const connection = await this.connections.openAppStoreListing();
    if (!connection || connection.status === 'rejected') {
      return { nominations: 0, promoText: 0 };
    }
    const apps = await this.prisma.app.findMany({
      where: { store: STORE, isCompetitor: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, storeAppId: true },
    });
    let nominations = 0;
    let promoText = 0;
    for (const app of apps) {
      try {
        const outcome = await this.syncApp(connection, app);
        nominations += outcome.nominations;
        promoText += outcome.promoText;
      } catch (error) {
        if (error instanceof AscRateLimitedError) throw error;
        this.logger.warn(
          `the featuring reads of app ${app.id} wait for the next sync: ${messageOf(error)}`,
        );
      }
    }
    return { nominations, promoText };
  }

  private async syncApp(
    connection: OpenedConnection<AscListingApi>,
    app: SyncApp,
  ): Promise<AppOutcome> {
    const version = await this.liveVersionOf(connection.api, app.storeAppId);
    if (version.kind === 'invisible') {
      await this.recordUnread(app, FIELD_SYNC_UNSERVED_APP);
      return { nominations: 0, promoText: 0 };
    }
    if (version.kind === 'failed') {
      await this.recordUnread(app, version.message);
      return { nominations: 0, promoText: 0 };
    }
    const promo: PromoRead =
      version.kind === 'live'
        ? await this.promoOf(connection.api, version.id)
        : { kind: 'skipped', message: FIELD_SYNC_NO_LIVE_VERSION };
    let nominations: NominationsRead;
    try {
      nominations = await this.nominationsOf(connection.api, app.storeAppId);
    } catch (error) {
      if (error instanceof AscRateLimitedError) {
        await this.record(connection, app, promo, {
          kind: 'skipped',
          message: messageOf(error),
        });
      }
      throw error;
    }
    await this.record(connection, app, promo, nominations);
    return {
      nominations: nominations.kind === 'ok' ? 1 : 0,
      promoText: promo.kind === 'ok' ? promo.counts.total : 0,
    };
  }

  private async liveVersionOf(
    api: AscListingApi,
    storeAppId: string,
  ): Promise<LiveVersionRead> {
    try {
      const live = await api.liveVersion(storeAppId);
      if (live === null) {
        return { kind: 'noRelease' };
      }
      return { kind: 'live', id: live.id };
    } catch (error) {
      if (error instanceof AscRateLimitedError) throw error;
      if (!(error instanceof AscError)) throw error;
      if (isNotFound(error)) return { kind: 'invisible' };
      return { kind: 'failed', message: error.message };
    }
  }

  private async promoOf(
    api: AscListingApi,
    versionId: string,
  ): Promise<PromoRead> {
    try {
      const served = await api.versionLocalizations(versionId);
      return {
        kind: 'ok',
        counts: {
          filled: served.filter(
            ({ promotionalText }) => (promotionalText ?? '').length > 0,
          ).length,
          total: served.length,
        },
      };
    } catch (error) {
      if (error instanceof AscRateLimitedError) throw error;
      if (!(error instanceof AscError)) throw error;
      return { kind: 'skipped', message: error.message };
    }
  }

  private async nominationsOf(
    api: AscListingApi,
    storeAppId: string,
  ): Promise<NominationsRead> {
    let nominations: AscNomination[];
    try {
      nominations = await api.nominations(storeAppId, NOMINATION_STATES);
    } catch (error) {
      if (error instanceof AscForbiddenError) {
        return { kind: 'refused', message: FEATURING_ROLE_NEEDED };
      }
      if (error instanceof AscRateLimitedError) throw error;
      if (!(error instanceof AscError)) throw error;
      return { kind: 'skipped', message: error.message };
    }
    const counts = emptyCounts();
    for (const state of NOMINATION_STATES) {
      counts[NOMINATION_COUNT_OF[state]] = nominations.filter(
        (nomination) => nomination.state === state,
      ).length;
    }
    const newest = newestSubmitted(nominations);
    counts.submittedDate = asDate(newest?.submittedDate ?? null);
    counts.publishStartDate = asDate(newest?.publishStartDate ?? null);
    counts.publishEndDate = asDate(newest?.publishEndDate ?? null);
    return { kind: 'ok', counts };
  }

  private recordUnread(app: SyncApp, message: string): Promise<unknown> {
    return this.prisma.featuringSync.updateMany({
      where: { appId: app.id },
      data: {
        roleRefused: false,
        nominationsError: message,
        promoError: message,
      },
    });
  }

  private async record(
    connection: OpenedConnection<AscListingApi>,
    app: SyncApp,
    promo: PromoRead,
    nominations: NominationsRead,
  ): Promise<void> {
    const workspaceId = this.workspace.require('a featuring read');
    const base = {
      ...(nominations.kind === 'ok' ? nominationData(nominations.counts) : {}),
      ...(promo.kind === 'ok'
        ? { promoFilled: promo.counts.filled, promoTotal: promo.counts.total }
        : {}),
      nominationsError: nominationsErrorOf(nominations),
      promoError: promo.kind === 'ok' ? null : promo.message,
      readAt: new Date(),
    };
    const updated = await this.prisma.featuringSync.updateMany({
      where: { appId: app.id },
      data: {
        ...base,
        ...(nominations.kind === 'skipped'
          ? {}
          : { roleRefused: nominations.kind === 'refused' }),
      },
    });
    if (updated.count > 0) {
      return;
    }
    await this.prisma.withTransaction((tx) =>
      this.createStored(tx, connection, {
        workspaceId,
        appId: app.id,
        ...base,
        roleRefused: nominations.kind === 'refused',
      }),
    );
  }

  private async createStored(
    tx: Prisma.TransactionClient,
    connection: OpenedConnection<AscListingApi>,
    row: Prisma.FeaturingSyncUncheckedCreateInput,
  ): Promise<void> {
    const active = await tx.storeConnection.findFirst({
      where: { id: connection.id, status: 'active' },
      select: { id: true },
    });
    if (!active) {
      return;
    }
    await tx.featuringSync.create({ data: row });
  }
}
