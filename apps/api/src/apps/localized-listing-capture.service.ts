import { Injectable, Logger } from '@nestjs/common';
import { App, AppSnapshot, Store } from '@prisma/client';
import {
  AppStoreLocalization,
  nativeLocalizations,
  SnapshotChange,
} from '@asobeast/shared';
import { ChangesService } from '../changes/changes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenshotQueue } from '../screenshots/screenshot-queue';
import { ScreenshotRecorder } from '../screenshots/screenshot-recorder';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { NormalizedApp } from '../store-providers/types';
import { snapshotIcon, toSnapshotData } from './apps.mapper';
import { toChangeSnapshot } from './change-snapshot';
import { withKnownSubtitle } from './known-subtitle';
import { listingIn, NEWEST_FIRST, storedMarket } from './listing';
import { ComparableListing, servesLocalization } from './localization-served';
import { diffSnapshots, withRecordedChanges } from './snapshot-diff';

type ListedApp = Pick<App, 'id' | 'store' | 'storeAppId' | 'country'>;

interface LocalizedListing {
  market: string;
  localization: AppStoreLocalization;
}

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class LocalizedListingCapture {
  private readonly logger = new Logger(LocalizedListingCapture.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly egress: ProxyEgress,
    private readonly changes: ChangesService,
    private readonly screenshots: ScreenshotRecorder,
    private readonly screenshotQueue: ScreenshotQueue,
  ) {}

  async capture(
    app: ListedApp,
    market: string,
    fallback: ComparableListing,
  ): Promise<SnapshotChange[]> {
    if (app.store !== Store.APP_STORE) return [];
    const changes: SnapshotChange[] = [];
    for (const localization of nativeLocalizations(market)) {
      try {
        changes.push(
          ...(await this.captureOne(app, market, localization, fallback)),
        );
      } catch (error: unknown) {
        this.logger.warn(
          `could not capture the ${localization} listing of ${app.id} in ${market}, so it waits for the next refresh: ${reason(error)}`,
        );
      }
    }
    return changes;
  }

  private async captureOne(
    app: ListedApp,
    market: string,
    localization: AppStoreLocalization,
    fallback: ComparableListing,
  ): Promise<SnapshotChange[]> {
    const normalized = await this.egress.through(app.store, market, () =>
      this.registry.get(app.store).getApp(app.storeAppId, market, localization),
    );
    const previous = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...listingIn(app.country, market, localization) },
      orderBy: NEWEST_FIRST,
    });
    if (!previous && !servesLocalization(app.store, fallback, normalized)) {
      return [];
    }
    const snapshot = await this.store(
      app,
      { market, localization },
      normalized,
      previous,
    );
    const recorded = await this.changes.recordMarketRefresh(
      app.id,
      { home: app.country, market, localization },
      previous
        ? toChangeSnapshot(
            previous,
            snapshotIcon(app.store, previous),
            app.store,
          )
        : null,
      toChangeSnapshot(snapshot, snapshotIcon(app.store, snapshot), app.store),
    );
    return withRecordedChanges(diffSnapshots(previous, snapshot), recorded).map(
      (change) => ({ ...change, localization }),
    );
  }

  private async store(
    app: ListedApp,
    { market, localization }: LocalizedListing,
    normalized: NormalizedApp,
    previous: AppSnapshot | null,
  ): Promise<AppSnapshot> {
    let pending = 0;
    const snapshot = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.appSnapshot.create({
        data: toSnapshotData(
          app.id,
          withKnownSubtitle(normalized, previous?.subtitle ?? null),
          storedMarket(app.country, market),
          localization,
        ),
      });
      pending = await this.screenshots.record(
        tx,
        { store: app.store, country: market, localization },
        created,
      );
      return created;
    });
    if (pending > 0) await this.screenshotQueue.request(app.id, snapshot.id);
    return snapshot;
  }
}
