import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  AppStoreLocalization,
  assertStorefront,
  KeywordCoverageRow,
  MetadataAuditResult,
  defaultLocalizationIn,
  ScreenshotItem,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { suggestKeywordField } from './keyword-field-suggestion';
import { competitorNames } from './competitor-names';
import { loadCoverageSources } from './coverage-sources';
import {
  CoverageSources,
  judgeKeywordCoverage,
} from './keyword-coverage-judge';
import {
  lintContextOf,
  listingFieldAudits,
  listingFieldTexts,
} from './listing-field-audits';
import { keywordFieldOf } from './listing-surfaces';
import { ListingTexts } from '../apps/listing-texts';
import { missingListing } from '../apps/missing-listing';
import { ScreenshotsService } from '../screenshots/screenshots.service';
import {
  screenshotTextCoverage,
  screenshotTextState,
} from './screenshot-coverage';

type JudgedCoverageRow = KeywordCoverageRow & { listingCountry: string };

function refuseMissingView(
  view: ListingTexts | undefined,
  home: string,
  market: string,
  localization: AppStoreLocalization | null,
): void {
  if (localization !== null && !view) {
    throw missingListing(market, localization);
  }
  if (market !== home && !view) {
    throw missingListing(market);
  }
}

@Injectable()
export class MetadataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
    private readonly screenshots: ScreenshotsService,
  ) {}

  async audit(
    appId: string,
    country?: string,
    localization: AppStoreLocalization | null = null,
  ): Promise<MetadataAuditResult> {
    const app = await this.ensureApp(appId);
    const market = country ?? app.country;
    if (market !== app.country) {
      assertStorefront(app.store, market);
    }
    const [tracked, competitors] = await Promise.all([
      this.keywords.listTracked(appId, undefined, country, {
        brandFacts: app.store === Store.APP_STORE,
      }),
      competitorNames(this.prisma, appId),
    ]);
    const active = tracked.filter((item) => item.active);
    const { sources, view } = await loadCoverageSources(
      this.prisma,
      app,
      active.map((item) => item.country),
      { market, localization },
    );
    refuseMissingView(view, app.country, market, localization);
    const { listings, keywordFields } = sources;
    const viewLocalization = localization ?? defaultLocalizationIn(app, market);

    const keywordFieldValue =
      app.store === Store.APP_STORE
        ? keywordFieldOf(keywordFields, viewLocalization)
        : '';
    const texts = listingFieldTexts(view, keywordFieldValue);
    const fields = listingFieldAudits(
      app.store,
      texts,
      lintContextOf(texts, {
        appName: app.name,
        competitorNames: competitors,
        trackedKeywords: active.map((item) => item.text),
      }),
    );

    const coverage = this.judgeCoverage(app, active, sources);
    const shots = await this.screenshotsOf(app.store, listings, [
      market,
      ...coverage.map((row) => row.listingCountry),
    ]);
    const reading = this.screenshots.reading(app.store);
    const textOf = (listing: string) =>
      screenshotTextState(shots(listing), reading);
    const screenshotText = textOf(market);

    return {
      appId,
      store: app.store,
      fields,
      coverage: coverage.map((row) =>
        textOf(row.listingCountry)?.status === 'ready'
          ? {
              ...row,
              screenshotText: screenshotTextCoverage(
                shots(row.listingCountry),
                row.text,
              ),
            }
          : row,
      ),
      keywordFieldSuggestion:
        app.store === Store.APP_STORE
          ? suggestKeywordField(
              active.filter((item) => item.country === market),
              coverage.filter((row) => row.country === market),
              viewLocalization,
            )
          : null,
      ...(screenshotText ? { screenshotText } : {}),
      country: market,
      ...(localization === null ? {} : { localization }),
    };
  }

  private async screenshotsOf(
    store: Store,
    listings: ReadonlyMap<string, ListingTexts>,
    markets: readonly string[],
  ): Promise<(market: string) => ScreenshotItem[]> {
    const snapshotIds = new Map(
      markets.flatMap((market) => {
        const listing = listings.get(market);
        return listing ? [[market, listing.id] as const] : [];
      }),
    );
    const screenshots = await this.screenshots.ofSnapshots(store, [
      ...new Set(snapshotIds.values()),
    ]);
    return (market) => {
      const snapshotId = snapshotIds.get(market);
      return snapshotId === undefined
        ? []
        : (screenshots.get(snapshotId) ?? []);
    };
  }

  private judgeCoverage(
    app: { store: Store; country: string },
    active: TrackedKeywordItem[],
    sources: CoverageSources,
  ): JudgedCoverageRow[] {
    return active.map((item) => {
      const { fields, listingCountry, uncovered, wordsSplit } =
        judgeKeywordCoverage(app, item, sources);
      return {
        keywordId: item.keywordId,
        text: item.text,
        bucket: item.bucket,
        fields,
        uncovered,
        ...(wordsSplit ? { wordsSplit } : {}),
        country: item.country,
        listingCountry,
      };
    });
  }

  private async ensureApp(appId: string): Promise<{
    id: string;
    store: Store;
    name: string | null;
    country: string;
    defaultLocalization: string | null;
  }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        store: true,
        name: true,
        country: true,
        defaultLocalization: true,
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }
}
