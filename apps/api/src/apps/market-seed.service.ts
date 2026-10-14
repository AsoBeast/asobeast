import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertStorefront, MarketSeedResult } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { Candidate } from '../keywords/extraction';
import { KeywordTracker } from '../keywords/keyword-tracker';
import { loadTrackingStates } from '../keywords/keyword-tracking-state';
import { KeywordApp } from '../keywords/keywords.support';
import { seedCandidates } from '../keywords/listing-seed';
import { listingTexts } from '../keywords/listing-texts';
import { MarketListingRequests } from '../keywords/market-listing.requests';
import { PrismaService } from '../prisma/prisma.service';
import { FirstRunScheduler } from './first-run.scheduler';
import { ListingCaptureService } from './listing-capture.service';
import { capturedLocalizations } from './market-localizations';
import { planSeed } from './market-seed-plan';
import { shippedLocalizations } from './shipped-localizations';
import { marketDailyRequests, seedCost } from './market-cost';

@Injectable()
export class MarketSeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capture: ListingCaptureService,
    private readonly tracker: KeywordTracker,
    private readonly quota: QuotaService,
    private readonly firstRun: FirstRunScheduler,
    private readonly listings: MarketListingRequests,
  ) {}

  async seed(
    appId: string,
    country: string,
    spend: () => Promise<void>,
  ): Promise<MarketSeedResult> {
    const app = await this.primaryApp(appId);
    assertStorefront(app.store, country);
    if (country === app.country) {
      throw new BadRequestException(
        'The home market is seeded when the app is imported',
      );
    }
    await spend();
    const captured = await this.capture.refreshListing(app.id, country);
    if (captured === null) {
      return {
        country,
        status: 'unavailable',
        seeded: 0,
        skipped: 0,
        cost: seedCost(app.store, { opened: 0, listingReads: 0 }),
      };
    }
    const shipped = await shippedLocalizations(this.prisma, app);
    const candidates = seedCandidates(
      app.store,
      await listingTexts(
        this.prisma,
        app,
        country,
        capturedLocalizations(country, shipped),
      ),
    );
    const [tracking, room, alreadyTracked] = await Promise.all([
      loadTrackingStates(
        this.prisma,
        app,
        candidates.map(({ text }) => ({ text, country })),
      ),
      this.room(),
      this.tracksMarket(app.id, country),
    ]);
    const plan = planSeed(candidates, tracking, country, room);
    const seeded = await this.track(app, country, plan.chosen);
    const opensListing = seeded > 0 && !alreadyTracked;
    return {
      country,
      status: 'seeded',
      seeded,
      skipped: plan.skipped,
      cost: seedCost(app.store, {
        opened: Math.min(plan.opened, seeded),
        listingReads: opensListing
          ? await this.listingReads(app, country, shipped)
          : 0,
      }),
    };
  }

  private async track(
    app: KeywordApp,
    country: string,
    chosen: readonly Candidate[],
  ): Promise<number> {
    if (chosen.length === 0) return 0;
    const ids = await this.tracker.keywordIdMap(
      chosen.map(({ text }) => text),
      app.store,
      country,
    );
    const rows = chosen.flatMap(({ text, source }) => {
      const keywordId = ids.get(text);
      return keywordId
        ? [{ appId: app.id, keywordId, source, active: true }]
        : [];
    });
    const seeded = await this.quota.admitKeywordMarkets(async (tx) => {
      const { count } = await tx.trackedKeyword.createMany({
        data: rows,
        skipDuplicates: true,
      });
      return count;
    });
    if (seeded === 0) return 0;
    const keywordIds = rows.map(({ keywordId }) => keywordId);
    await this.tracker.enqueueFirstScores(keywordIds, app);
    await this.firstRun.checkKeywords(app.id, keywordIds);
    await this.listings.request(app, country);
    return seeded;
  }

  private async primaryApp(appId: string): Promise<KeywordApp> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        workspaceId: true,
        store: true,
        country: true,
        storeAppId: true,
        isCompetitor: true,
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    if (app.isCompetitor) {
      throw new BadRequestException(
        'A competitor app is not seeded; seed its primary app',
      );
    }
    return app;
  }

  private async room(): Promise<number | null> {
    const usage = await this.quota.usage();
    const limit = usage.limits.keywordMarkets;
    return limit === null ? null : Math.max(0, limit - usage.keywordMarkets);
  }

  private async tracksMarket(appId: string, country: string): Promise<boolean> {
    const tracked = await this.prisma.trackedKeyword.count({
      where: { appId, active: true, keyword: { country } },
    });
    return tracked > 0;
  }

  private async listingReads(
    app: KeywordApp,
    country: string,
    shipped: readonly string[],
  ): Promise<number> {
    const family = await this.prisma.app.count({
      where: { OR: [{ id: app.id }, { primaryAppId: app.id }] },
    });
    return marketDailyRequests(app.store, country, family, shipped).listing;
  }
}
