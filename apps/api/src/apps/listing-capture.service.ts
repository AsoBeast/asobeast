import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { App, Prisma, Store } from '@prisma/client';
import { assertStorefront, SnapshotDiffResult } from '@asobeast/shared';
import { ChangesService } from '../changes/changes.service';
import type { DetectedChange } from '../changes/change-detector';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenshotQueue } from '../screenshots/screenshot-queue';
import { ScreenshotRecorder } from '../screenshots/screenshot-recorder';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreAppNotFoundError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { currencyOf } from '../store-providers/raw-facts';
import { NormalizedApp } from '../store-providers/types';
import { StoreReportQueue } from '../store-connect/store-report-queue';
import { snapshotIcon, toSnapshotData } from './apps.mapper';
import { toChangeSnapshot } from './change-snapshot';
import { withKnownSubtitle } from './known-subtitle';
import { listingIn, NEWEST_FIRST, storedMarket } from './listing';
import { LocalizationDetection } from './localization-detection.service';
import { LocalizedListingCapture } from './localized-listing-capture.service';
import { MarketLocalizationRecorder } from './market-localization-recorder';
import { diffSnapshots, withRecordedChanges } from './snapshot-diff';

@Injectable()
export class ListingCaptureService {
  private readonly logger = new Logger(ListingCaptureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly egress: ProxyEgress,
    private readonly keywords: KeywordsService,
    private readonly changes: ChangesService,
    private readonly screenshots: ScreenshotRecorder,
    private readonly screenshotQueue: ScreenshotQueue,
    private readonly localizations: LocalizedListingCapture,
    private readonly detection: LocalizationDetection,
    private readonly recorder: MarketLocalizationRecorder,
    private readonly storeReports: StoreReportQueue,
  ) {}

  async refresh(
    id: string,
    country?: string,
    spend: () => Promise<void> = () => Promise.resolve(),
  ): Promise<SnapshotDiffResult> {
    const app = await this.requireApp(id);
    const market = country ?? app.country;
    if (market !== app.country) {
      await this.assertTracksMarket(app, market);
    }
    await spend();
    return this.captureListing(app, market);
  }

  async refreshListing(
    id: string,
    country?: string,
  ): Promise<SnapshotDiffResult | null> {
    const app = await this.prisma.app.findFirst({ where: { id } });
    if (!app) {
      return null;
    }
    const market = country ?? app.country;
    try {
      return await this.captureListing(app, market);
    } catch (error: unknown) {
      if (!(error instanceof StoreAppNotFoundError)) throw error;
      if (market === app.country) {
        this.logger.warn(
          `${app.storeAppId} is no longer listed in ${market}, so its listing was not refreshed`,
        );
      } else {
        this.logger.log(
          `${app.storeAppId} is not listed in ${market}, so it has no listing there`,
        );
      }
      return null;
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
    const normalized = await this.readListing(app, market);
    const previous = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...listingIn(app.country, market) },
      orderBy: NEWEST_FIRST,
    });

    let pending = 0;
    const snapshot = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.appSnapshot.create({
        data: toSnapshotData(
          app.id,
          withKnownSubtitle(normalized, previous?.subtitle ?? null),
          storedMarket(app.country, market),
        ),
      });
      await this.recordListed(tx, app, market, normalized);
      pending = await this.screenshots.record(
        tx,
        { store: app.store, country: market },
        created,
      );
      return created;
    });
    if (pending > 0) await this.screenshotQueue.request(app.id, snapshot.id);

    const icons = home
      ? { before: app.iconUrl, after: normalized.iconUrl ?? null }
      : {
          before: previous ? snapshotIcon(app.store, previous) : null,
          after: snapshotIcon(app.store, snapshot),
        };
    const before = previous
      ? toChangeSnapshot(previous, icons.before, app.store)
      : null;
    const after = toChangeSnapshot(snapshot, icons.after, app.store);

    const recorded = home
      ? await this.changes.recordRefresh(app.id, before, after)
      : await this.changes.recordMarketRefresh(
          app.id,
          { home: app.country, market },
          before,
          after,
        );
    const listing = {
      ...snapshot,
      subtitleUnavailable: normalized.subtitleUnavailable,
    };
    const localized = await this.localizations.capture(app, market, listing);
    await this.recorder.record(app, market, listing, localized);
    if (
      !home &&
      !previous &&
      !app.isCompetitor &&
      app.store === Store.APP_STORE
    ) {
      await this.requestDetection(app.id, market);
    }
    if (home) {
      await this.keywords.syncFromSnapshot(app.id);
      if (await this.releaseChangedFields(app, recorded)) {
        await this.storeReports.enqueue(app.workspaceId, app.store);
      }
    }

    return {
      snapshotId: snapshot.id,
      changes: [
        ...withRecordedChanges(diffSnapshots(previous, snapshot), recorded),
        ...localized.changes,
      ],
      country: market,
      currency: currencyOf(snapshot.raw),
    };
  }

  private async releaseChangedFields(
    app: App,
    recorded: DetectedChange[],
  ): Promise<boolean> {
    if (app.store !== Store.APP_STORE || app.isCompetitor) return false;
    if (!(await this.fieldSyncConnected())) return false;
    if (recorded.some(({ field }) => field === 'version')) return true;
    const synced = await this.prisma.keywordFieldSync.findFirst({
      where: { appId: app.id },
      select: { appId: true },
    });
    return synced === null;
  }

  private async fieldSyncConnected(): Promise<boolean> {
    const connection = await this.prisma.storeConnection.findFirst({
      where: { store: Store.APP_STORE, status: 'active' },
      select: { store: true },
    });
    return connection !== null;
  }

  private async readListing(app: App, market: string): Promise<NormalizedApp> {
    try {
      return await this.egress.through(app.store, market, () =>
        this.registry.get(app.store).getApp(app.storeAppId, market),
      );
    } catch (error: unknown) {
      if (error instanceof StoreAppNotFoundError) {
        await this.recordUnlisted(app, market);
      }
      throw error;
    }
  }

  private async recordListed(
    tx: Prisma.TransactionClient,
    app: App,
    market: string,
    normalized: NormalizedApp,
  ): Promise<void> {
    if (market === app.country) {
      await tx.app.update({
        where: { id: app.id },
        data: {
          name: normalized.title,
          iconUrl: normalized.iconUrl,
          delistedAt: null,
        },
      });
    } else {
      await tx.$executeRaw`
        UPDATE "App"
        SET "unlistedMarkets" = array_remove("unlistedMarkets", ${market})
        WHERE "id" = ${app.id} AND ${market} = ANY("unlistedMarkets")
      `;
    }
  }

  private async recordUnlisted(app: App, market: string): Promise<void> {
    await this.prisma.app.updateMany(
      market === app.country
        ? {
            where: { id: app.id, delistedAt: null },
            data: { delistedAt: new Date() },
          }
        : {
            where: { id: app.id, NOT: { unlistedMarkets: { has: market } } },
            data: { unlistedMarkets: { push: market } },
          },
    );
  }

  private async requestDetection(appId: string, market: string): Promise<void> {
    try {
      await this.detection.request(appId, () => Promise.resolve(), market);
    } catch (error: unknown) {
      this.logger.warn(
        `could not queue the localization probes of ${appId} after its first market capture, so they wait for the sweep: ${reason(error)}`,
      );
    }
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
