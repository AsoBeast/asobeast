import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  DISCOVERY_POOL_LIMIT,
  DiscoverySource,
  normalizeText,
} from '@asobeast/shared';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';
import { capturedLocalizations } from '../apps/market-localizations';
import { shippedLocalizations } from '../apps/shipped-localizations';
import { CandidateSource } from '../keywords/extraction';
import { listingLanguages } from '../keywords/listing-languages';
import { seedCandidates } from '../keywords/listing-seed';
import { ListingText, listingTexts } from '../keywords/listing-texts';
import { REVIEW_THEME_MIN_MENTIONS } from '../keywords/review-mining';
import {
  competitorPhrases,
  recentReviewPhrases,
} from '../keywords/suggestion-phrases';
import { PrismaService } from '../prisma/prisma.service';
import { popularityGenreOf } from '../scoring/apple-genres';
import { primaryGenreId } from '../store-providers/raw-facts';
import { DiscoveryPopularity } from './discovery-popularity.service';
import { discoveryRelevance, PoolCandidate } from './discovery-pool';
import { overlappingTerms } from './popularity-terms';

export interface DiscoveryApp {
  id: string;
  workspaceId: string;
  store: Store;
  country: string;
  storeAppId: string;
}

const DISCOVERY_SOURCE_CAPS = {
  competitors: 60,
  reviews: 40,
  popularity: 60,
  portfolio: 60,
} as const;

const MIN_REVIEW_PHRASE_WORDS = 2;

const wordCount = (text: string): number =>
  text.split(' ').filter((word) => word.length > 0).length;

const LISTING_SOURCE: Record<CandidateSource, DiscoverySource> = {
  TITLE: 'title',
  SUBTITLE: 'subtitle',
  DESCRIPTION: 'description',
};

const NOTHING_EXCLUDED: ReadonlySet<string> = new Set();
const NO_CANDIDATES: Promise<SourcedText[]> = Promise.resolve([]);

interface SourcedText {
  text: string;
  source: DiscoverySource;
}

const sourced = (
  texts: readonly string[],
  source: DiscoverySource,
): SourcedText[] =>
  texts
    .map(normalizeText)
    .filter((text) => text.length > 0)
    .map((text) => ({ text, source }));

const listingFieldTexts = (listings: readonly ListingText[]): string[] =>
  listings.flatMap(({ title, subtitle, summary }) =>
    [title, subtitle, summary].filter((text): text is string => text !== null),
  );

@Injectable()
export class DiscoveryCandidates {
  constructor(
    private readonly prisma: PrismaService,
    private readonly popularity: DiscoveryPopularity,
  ) {}

  async forMarket(
    app: DiscoveryApp,
    market: string,
    snapshotText: string,
  ): Promise<PoolCandidate[]> {
    const listings = await this.listings(app, market);
    const home = market === app.country;
    const found = [
      ...this.listingCandidates(app, listings),
      ...(
        await Promise.all([
          home ? this.competitorCandidates(app) : NO_CANDIDATES,
          home ? this.reviewCandidates(app) : NO_CANDIDATES,
          this.popularityCandidates(app, market, listings),
          this.portfolioCandidates(app, market),
        ])
      ).flat(),
    ];
    const traffic = await this.trafficOf(
      app.store,
      market,
      found.map(({ text }) => text),
    );
    return found.map(({ text, source }) => ({
      text,
      source,
      relevance: discoveryRelevance(source, text, snapshotText),
      traffic: traffic.get(text) ?? null,
    }));
  }

  private async listings(
    app: DiscoveryApp,
    market: string,
  ): Promise<ListingText[]> {
    const shipped = await shippedLocalizations(this.prisma, app);
    return listingTexts(
      this.prisma,
      app,
      market,
      capturedLocalizations(market, shipped),
    );
  }

  private listingCandidates(
    app: DiscoveryApp,
    listings: readonly ListingText[],
  ): SourcedText[] {
    return seedCandidates(app.store, listings, DISCOVERY_POOL_LIMIT).map(
      ({ text, source }) => ({ text, source: LISTING_SOURCE[source] }),
    );
  }

  private async competitorCandidates(
    app: DiscoveryApp,
  ): Promise<SourcedText[]> {
    const phrases = await competitorPhrases(
      this.prisma,
      app.id,
      NOTHING_EXCLUDED,
      listingLanguages(app.store, app.country),
      DISCOVERY_SOURCE_CAPS.competitors,
    );
    return sourced(
      phrases.map(({ text }) => text),
      'competitors',
    );
  }

  private async reviewCandidates(app: DiscoveryApp): Promise<SourcedText[]> {
    const phrases = await recentReviewPhrases(
      this.prisma,
      app.id,
      new Set(),
      listingLanguages(app.store, app.country),
      Number.POSITIVE_INFINITY,
    );
    return sourced(
      phrases
        .filter(
          ({ text, usedByCount }) =>
            (usedByCount ?? 0) >= REVIEW_THEME_MIN_MENTIONS &&
            wordCount(text) >= MIN_REVIEW_PHRASE_WORDS,
        )
        .slice(0, DISCOVERY_SOURCE_CAPS.reviews)
        .map(({ text }) => text),
      'reviews',
    );
  }

  private async popularityCandidates(
    app: DiscoveryApp,
    market: string,
    listings: readonly ListingText[],
  ): Promise<SourcedText[]> {
    if (app.store !== Store.APP_STORE) return [];
    const genre = await this.genreOf(app);
    if (!genre) return [];
    const terms = await this.popularity.genreTerms(market, genre);
    const overlapping = overlappingTerms(
      terms,
      listingFieldTexts(listings),
      listingLanguages(app.store, market),
    );
    return sourced(
      overlapping.map(({ term }) => term),
      'popularity',
    ).slice(0, DISCOVERY_SOURCE_CAPS.popularity);
  }

  private async portfolioCandidates(
    app: DiscoveryApp,
    market: string,
  ): Promise<SourcedText[]> {
    const keywords = await this.prisma.keyword.findMany({
      where: {
        store: app.store,
        country: market,
        tracked: { some: { appId: { not: app.id } } },
      },
      orderBy: { createdAt: 'desc' },
      take: DISCOVERY_SOURCE_CAPS.portfolio,
      select: { text: true },
    });
    return sourced(
      keywords.map(({ text }) => text),
      'portfolio',
    );
  }

  private async genreOf(app: DiscoveryApp): Promise<string | undefined> {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
      select: { raw: true },
    });
    return snapshot
      ? popularityGenreOf(primaryGenreId(snapshot.raw))
      : undefined;
  }

  private async trafficOf(
    store: Store,
    market: string,
    texts: readonly string[],
  ): Promise<Map<string, number>> {
    const unique = [...new Set(texts)];
    if (unique.length === 0) return new Map();
    const keywords = await this.prisma.keyword.findMany({
      where: { store, country: market, text: { in: unique } },
      select: {
        text: true,
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { traffic: true },
        },
      },
    });
    const traffic = new Map<string, number>();
    for (const { text, metrics } of keywords) {
      const scored = metrics[0]?.traffic;
      if (scored !== null && scored !== undefined) traffic.set(text, scored);
    }
    if (store !== Store.APP_STORE) return traffic;
    const listed = await this.popularity.listedTraffic(
      market,
      unique.filter((text) => !traffic.has(text)),
    );
    return new Map([...listed, ...traffic]);
  }
}
