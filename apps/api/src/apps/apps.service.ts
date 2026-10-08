import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  AppDetail,
  AppListItem,
  AppStoreLocalization,
  parseStoreUrl,
  assertStorefront,
  ListingMarket,
  MarketAvailabilityResult,
  SnapshotDiffResult,
  SUPPORTED_STORES,
} from '@asobeast/shared';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoreNotSupportedError } from '../store-providers/errors';
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
import { toAppDetail, toAppListItem } from './apps.mapper';
import { FirstRunScheduler } from './first-run.scheduler';
import { ListingCaptureService } from './listing-capture.service';
import { ListingReadService } from './listing-read.service';
import { LocalizedListingCapture } from './localized-listing-capture.service';
import { LATEST_HOME_LISTING } from './listing';

const REVIEW_BACKFILL_PAGES = 3;

@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly capture: AppCaptureService,
    private readonly keywords: KeywordsService,
    private readonly listingCapture: ListingCaptureService,
    private readonly listingReads: ListingReadService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly quota: QuotaService,
    private readonly egress: ProxyEgress,
    private readonly workspace: WorkspaceContext,
    private readonly firstRun: FirstRunScheduler,
    private readonly localizations: LocalizedListingCapture,
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

    await this.localizations.capture(app, market, snapshot);
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

  async detail(
    id: string,
    country?: string,
    localization?: AppStoreLocalization,
  ): Promise<AppDetail> {
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
    const market = country ?? app.country;
    if (localization === undefined && market === app.country) {
      return toAppDetail(
        app,
        app.snapshots[0] ?? null,
        app.competitors,
        app.group,
      );
    }
    assertStorefront(app.store, market);
    return this.listingReads.marketDetail(app, market, localization ?? null);
  }

  listingMarkets(id: string): Promise<ListingMarket[]> {
    return this.listingReads.markets(id);
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

  refreshApp(
    id: string,
    country?: string,
    spend?: () => Promise<void>,
  ): Promise<SnapshotDiffResult> {
    return this.listingCapture.refresh(id, country, spend);
  }

  refreshListing(
    id: string,
    country: string,
  ): Promise<SnapshotDiffResult | null> {
    return this.listingCapture.refreshListing(id, country);
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
