import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { App } from '@prisma/client';
import { assertStorefront, SnapshotDiffResult } from '@asobeast/shared';
import { ChangesService } from '../changes/changes.service';
import {
  DetectedChange,
  DiffableChangeSnapshot,
} from '../changes/change-detector';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenshotQueue } from '../screenshots/screenshot-queue';
import { ScreenshotRecorder } from '../screenshots/screenshot-recorder';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreAppNotFoundError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { snapshotIcon, toSnapshotData } from './apps.mapper';
import { toChangeSnapshot } from './change-snapshot';
import { withKnownSubtitle } from './known-subtitle';
import { listingIn, NEWEST_FIRST, storedMarket } from './listing';
import { LocalizedListingCapture } from './localized-listing-capture.service';
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

    let pending = 0;
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
      ? await this.recordHomeRefresh(app.id, before, after)
      : await this.changes.recordMarketRefresh(
          app.id,
          { home: app.country, market },
          before,
          after,
        );

    const localized = await this.localizations.capture(app, market, snapshot);

    return {
      snapshotId: snapshot.id,
      changes: [
        ...withRecordedChanges(diffSnapshots(previous, snapshot), recorded),
        ...localized,
      ],
      country: market,
    };
  }

  private async recordHomeRefresh(
    appId: string,
    before: DiffableChangeSnapshot | null,
    after: DiffableChangeSnapshot,
  ): Promise<DetectedChange[]> {
    await this.keywords.syncFromSnapshot(appId);
    return this.changes.recordRefresh(appId, before, after);
  }
}
