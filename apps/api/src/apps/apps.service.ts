import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { App, AppSnapshot, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  AppDetail,
  AppListItem,
  assertStorefront,
  MarketAvailabilityResult,
  parseStoreUrl,
  SnapshotDiffResult,
  SUPPORTED_STORES,
} from '@asobeast/shared';
import { ChangesService } from '../changes/changes.service';
import { DiffableChangeSnapshot } from '../changes/change-detector';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  StoreAppNotFoundError,
  StoreNotSupportedError,
} from '../store-providers/errors';
import {
  releaseNotesFor,
  screenshotsCount,
} from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import {
  JOBS,
  QUEUES,
  queueNameForStore,
  reviewsBackfillJobId,
} from '../jobs/jobs.types';
import { AppCaptureService } from './app-capture.service';
import { reviewSyncJobOptions } from '../jobs/job-options';
import { QuotaService } from '../auth/quota.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  snapshotIcon,
  toAppDetail,
  toAppListItem,
  toSnapshotData,
} from './apps.mapper';
import { FirstRunScheduler } from './first-run.scheduler';
import { withKnownSubtitle } from './known-subtitle';
import { diffSnapshots } from './snapshot-diff';
import {
  LATEST_HOME_LISTING,
  listingIn,
  NEWEST_FIRST,
  storedMarket,
} from './listing';

const REVIEW_BACKFILL_PAGES = 3;

@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly capture: AppCaptureService,
    private readonly keywords: KeywordsService,
    private readonly changes: ChangesService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly quota: QuotaService,
    private readonly egress: ProxyEgress,
    private readonly workspace: WorkspaceContext,
    private readonly firstRun: FirstRunScheduler,
  ) {}

  private queueFor(store: Store): Queue {
    return queueNameForStore(store) === QUEUES.GPLAY
      ? this.gplayQueue
      : this.appStoreQueue;
  }

  async importFromUrl(url: string, country?: string): Promise<AppDetail> {
    const { store, storeAppId, country: parsedCountry } = parseStoreUrl(url);

    if (!SUPPORTED_STORES.includes(store)) {
      throw new StoreNotSupportedError(store);
    }
    const market = country ?? parsedCountry;
    assertStorefront(store, market);
    const known = await this.prisma.app.findFirst({
      where: {
        store,
        storeAppId,
        country: market,
        isCompetitor: false,
      },
      select: { id: true },
    });
    if (known) {
      return this.detail(known.id);
    }
    await this.quota.assertRoom('apps');

    const { app, snapshot } = await this.capture.capture(
      store,
      storeAppId,
      market,
      { admit: this.quota.admitApp() },
    );

    await this.keywords.syncFromSnapshot(app.id);

    await this.queueFor(store).add(
      JOBS.SYNC_REVIEWS,
      {
        appId: app.id,
        pages: REVIEW_BACKFILL_PAGES,
        backfill: true,
        workspaceId: app.workspaceId,
        correlationId: this.workspace.correlationId,
      },
      { jobId: reviewsBackfillJobId(app.id), ...reviewSyncJobOptions(store) },
    );

    await this.scheduleFirstRun(app.id);

    return toAppDetail(app, snapshot, [], null);
  }

  private async scheduleFirstRun(appId: string): Promise<void> {
    try {
      await this.firstRun.schedule(appId);
    } catch (error: unknown) {
      this.logger.error(
        `could not schedule the first run for ${appId}, so its positions wait for the next daily run: ${reason(error)}`,
      );
    }
  }

  async list(): Promise<AppListItem[]> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      include: {
        snapshots: LATEST_HOME_LISTING,
        _count: { select: { tracked: true, competitors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apps.map((app) =>
      toAppListItem(
        app,
        app.snapshots[0] ?? null,
        app._count.tracked,
        app._count.competitors,
      ),
    );
  }

  async detail(id: string): Promise<AppDetail> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      include: {
        snapshots: LATEST_HOME_LISTING,
        competitors: {
          include: { snapshots: LATEST_HOME_LISTING },
          orderBy: { createdAt: 'asc' },
        },
        group: { include: { apps: true } },
      },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    return toAppDetail(
      app,
      app.snapshots[0] ?? null,
      app.competitors,
      app.group,
    );
  }

  async marketAvailability(
    id: string,
    country: string,
  ): Promise<MarketAvailabilityResult> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { store: true, storeAppId: true, country: true },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    assertStorefront(app.store, country);
    if (app.country === country) {
      return { country, status: 'available' };
    }

    const [result] = await this.egress.through(app.store, country, () =>
      this.registry.get(app.store).availability(app.storeAppId, [country]),
    );

    return result ?? { country, status: 'unknown' };
  }

  private async ensureApp(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
  }

  async remove(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { id: true, groupId: true },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    await this.prisma.withTransaction(async (tx) => {
      await tx.app.delete({ where: { id: app.id } });
      if (app.groupId) {
        const remaining = await tx.app.count({
          where: { groupId: app.groupId },
        });
        if (remaining < 2) {
          await tx.app.updateMany({
            where: { groupId: app.groupId },
            data: { groupId: null },
          });
          await tx.appGroup.delete({ where: { id: app.groupId } });
        }
      }
    });
  }

  async refreshApp(id: string, country?: string): Promise<SnapshotDiffResult> {
    const app = await this.requireApp(id);
    const market = country ?? app.country;
    if (market !== app.country) {
      await this.assertTracksMarket(app, market);
    }
    return this.captureListing(app, market);
  }

  async refreshListing(
    id: string,
    country: string,
  ): Promise<SnapshotDiffResult | null> {
    const app = await this.requireApp(id);
    try {
      return await this.captureListing(app, country);
    } catch (error: unknown) {
      if (country !== app.country && error instanceof StoreAppNotFoundError) {
        this.logger.log(
          `${app.storeAppId} is not listed in ${country}, so it has no listing there`,
        );
        return null;
      }
      throw error;
    }
  }

  private async requireApp(id: string): Promise<App> {
    const app = await this.prisma.app.findFirst({ where: { id } });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
    return app;
  }

  private async assertTracksMarket(app: App, market: string): Promise<void> {
    assertStorefront(app.store, market);
    const tracked = await this.prisma.trackedKeyword.count({
      where: {
        appId: app.primaryAppId ?? app.id,
        keyword: { is: { country: market } },
      },
    });
    if (tracked === 0) {
      throw new BadRequestException(
        `No keywords are tracked in ${market}, so its listing is not captured`,
      );
    }
  }

  private async captureListing(
    app: App,
    market: string,
  ): Promise<SnapshotDiffResult> {
    const home = market === app.country;
    const normalized = await this.egress.through(app.store, market, () =>
      this.registry.get(app.store).getApp(app.storeAppId, market),
    );
    const previous = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...listingIn(app.country, market) },
      orderBy: NEWEST_FIRST,
    });

    const snapshot = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.appSnapshot.create({
        data: toSnapshotData(
          app.id,
          withKnownSubtitle(normalized, previous?.subtitle ?? null),
          storedMarket(app.country, market),
        ),
      });
      if (home) {
        await tx.app.update({
          where: { id: app.id },
          data: { name: normalized.title, iconUrl: normalized.iconUrl },
        });
      }
      return created;
    });

    const icons = home
      ? { before: app.iconUrl, after: normalized.iconUrl ?? null }
      : {
          before: previous ? snapshotIcon(app.store, previous) : null,
          after: snapshotIcon(app.store, snapshot),
        };
    const before = previous
      ? this.toChangeSnapshot(previous, icons.before, app.store)
      : null;
    const after = this.toChangeSnapshot(snapshot, icons.after, app.store);

    if (home) {
      await this.keywords.syncFromSnapshot(app.id);
      await this.changes.recordRefresh(app.id, before, after);
    } else {
      await this.changes.recordMarketRefresh(app.id, market, before, after);
    }

    return {
      snapshotId: snapshot.id,
      changes: diffSnapshots(previous, snapshot),
      country: market,
    };
  }

  private toChangeSnapshot(
    snapshot: AppSnapshot,
    iconUrl: string | null,
    store: Store,
  ): DiffableChangeSnapshot {
    return {
      title: snapshot.title,
      subtitle: snapshot.subtitle,
      summary: snapshot.summary,
      description: snapshot.description,
      version: snapshot.version,
      price: snapshot.price,
      screenshotsCount: screenshotsCount(snapshot.raw),
      iconUrl,
      releaseNotes: releaseNotesFor(store, snapshot.raw),
    };
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
