import { Injectable } from '@nestjs/common';
import { KeywordSource, Store } from '@prisma/client';
import {
  assertStorefront,
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  normalizeText,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { developerId } from '../store-providers/raw-facts';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import { extractCandidates } from './extraction';
import { reportedSource } from './keyword-field-membership';
import { ensureApp, trackedTexts } from './keywords.support';
import { listingLanguages } from './listing-languages';
import { mineReviewPhrases } from './review-mining';
import { seasonalSuggestions } from './seasonal-suggestions';
import {
  HOME_LISTING,
  LATEST_HOME_LISTING,
  NEWEST_FIRST,
} from '../apps/listing';

const REVIEW_MINING_CAP = 500;
const SEARCH_SEED_LIMIT = 5;

const REACHES_THE_STORE: Record<KeywordSuggestionStrategy, boolean> = {
  search: true,
  similar: true,
  developer: true,
  metadata: false,
  competitors: false,
  seasonal: false,
  reviews: false,
};

interface SuggestionRequest {
  appId: string;
  limit: number;
  tracked: Set<string>;
  market: { store: Store; country: string; storeAppId: string };
  languages: { home: readonly string[]; market: readonly string[] };
}

interface TitleCount {
  limit: number;
  strategy: 'similar' | 'developer';
  languages: readonly string[];
}

const SOURCE_WEIGHT: Record<KeywordSource, number> = {
  KEYWORD_FIELD: 4,
  TITLE: 3,
  SUBTITLE: 2,
  MANUAL: 2,
  SUGGESTED: 1,
  DESCRIPTION: 1,
  COMPETITOR: 1,
};

@Injectable()
export class KeywordSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly egress: ProxyEgress,
  ) {}

  async suggest(
    appId: string,
    strategy: KeywordSuggestionStrategy,
    limit: number,
    country?: string,
  ): Promise<KeywordSuggestion[]> {
    const app = await ensureApp(this.prisma, appId);
    const market = { ...app, country: country ?? app.country };
    assertStorefront(market.store, market.country);
    const request: SuggestionRequest = {
      appId,
      limit,
      market,
      tracked: await trackedTexts(this.prisma, appId, market.country),
      languages: {
        home: listingLanguages(app.store, app.country),
        market: listingLanguages(market.store, market.country),
      },
    };
    const work = () => this.dispatch(strategy, request);
    if (!REACHES_THE_STORE[strategy]) return work();
    return this.egress.through(market.store, market.country, work);
  }

  private dispatch(
    strategy: KeywordSuggestionStrategy,
    request: SuggestionRequest,
  ): Promise<KeywordSuggestion[]> {
    const { appId, limit, tracked, market, languages } = request;
    if (strategy === 'search') {
      return this.suggestFromSearch(appId, market, tracked, limit);
    }
    if (strategy === 'similar') {
      return this.suggestFromSimilar(request);
    }
    if (strategy === 'developer') {
      return this.suggestFromDeveloper(request);
    }
    if (strategy === 'competitors') {
      return this.suggestFromCompetitors(appId, tracked, limit, languages.home);
    }
    if (strategy === 'seasonal') {
      return Promise.resolve(
        seasonalSuggestions(new Date(), market.country, tracked, limit),
      );
    }
    if (strategy === 'reviews') {
      return this.suggestFromReviews(appId, tracked, limit);
    }
    return this.suggestFromMetadata(appId, tracked, limit, languages.home);
  }

  private async suggestFromReviews(
    appId: string,
    excluded: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const reviews = await this.prisma.review.findMany({
      where: { appId },
      orderBy: { reviewedAt: 'desc' },
      take: REVIEW_MINING_CAP,
      select: { title: true, text: true },
    });
    return mineReviewPhrases(reviews, excluded).slice(0, limit);
  }

  private async suggestFromCompetitors(
    appId: string,
    excluded: Set<string>,
    limit: number,
    languages: readonly string[],
  ): Promise<KeywordSuggestion[]> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      select: {
        snapshots: {
          ...LATEST_HOME_LISTING,
          select: { title: true, subtitle: true },
        },
      },
    });

    const counts = new Map<string, number>();
    for (const competitor of competitors) {
      const snapshot = competitor.snapshots[0];
      if (!snapshot) {
        continue;
      }
      const texts = new Set(
        extractCandidates(
          {
            title: snapshot.title,
            subtitle: snapshot.subtitle ?? undefined,
          },
          languages,
        ).map((candidate) => candidate.text),
      );
      for (const text of texts) {
        if (excluded.has(text)) {
          continue;
        }
        counts.set(text, (counts.get(text) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([text, usedByCount]) => ({
        text,
        strategy: 'competitors' as const,
        usedByCount,
      }));
  }

  private async suggestFromMetadata(
    appId: string,
    excluded: Set<string>,
    limit: number,
    languages: readonly string[],
  ): Promise<KeywordSuggestion[]> {
    const candidates = await this.latestCandidates(appId, languages);
    return candidates
      .filter((candidate) => !excluded.has(candidate.text))
      .slice(0, limit)
      .map((candidate) => ({
        text: candidate.text,
        strategy: 'metadata' as const,
      }));
  }

  private async suggestFromSearch(
    appId: string,
    app: { store: Store; country: string },
    excluded: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const provider = this.registry.get(app.store);
    const seeds = await this.searchSeeds(appId);
    const seedSet = new Set(seeds);
    const merged = new Map<string, number | undefined>();

    for (const seed of seeds) {
      const items = await provider.suggest(seed, app.country);
      for (const item of items) {
        const text = normalizeText(item.term);
        if (!text || excluded.has(text) || seedSet.has(text)) {
          continue;
        }
        if (!merged.has(text)) {
          merged.set(text, item.priority);
        } else if ((item.priority ?? -1) > (merged.get(text) ?? -1)) {
          merged.set(text, item.priority);
        }
      }
    }

    return [...merged.entries()]
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
      .slice(0, limit)
      .map(([text, priority]) => ({
        text,
        strategy: 'search' as const,
        ...(priority === undefined ? {} : { priority }),
      }));
  }

  private async suggestFromSimilar({
    market,
    tracked,
    limit,
    languages,
  }: SuggestionRequest): Promise<KeywordSuggestion[]> {
    const provider = this.registry.get(market.store);
    const similar = await provider.similar(market.storeAppId, market.country);
    return countTitleCandidates(similar, tracked, {
      limit,
      strategy: 'similar',
      languages: languages.market,
    });
  }

  private async suggestFromDeveloper({
    appId,
    market,
    tracked,
    limit,
    languages,
  }: SuggestionRequest): Promise<KeywordSuggestion[]> {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
      select: { raw: true, title: true },
    });
    const devId = snapshot && developerId(market.store, snapshot.raw);
    if (!devId) {
      return [];
    }

    const excluded = new Set(tracked);
    for (const candidate of extractCandidates(
      { title: snapshot.title },
      languages.home,
    )) {
      excluded.add(candidate.text);
    }

    const provider = this.registry.get(market.store);
    const apps = await provider.developerApps(devId, market.country);
    return countTitleCandidates(apps, excluded, {
      limit,
      strategy: 'developer',
      languages: languages.market,
    });
  }

  private async searchSeeds(appId: string): Promise<string[]> {
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: {
        source: true,
        fieldOrder: true,
        keyword: { select: { text: true } },
      },
    });
    return tracked
      .sort(
        (a, b) =>
          SOURCE_WEIGHT[reportedSource(b)] - SOURCE_WEIGHT[reportedSource(a)],
      )
      .slice(0, SEARCH_SEED_LIMIT)
      .map((row) => row.keyword.text);
  }

  private async latestCandidates(appId: string, languages: readonly string[]) {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return [];
    }
    return extractCandidates(
      {
        title: snapshot.title,
        subtitle: snapshot.subtitle ?? undefined,
        summary: snapshot.summary ?? undefined,
      },
      languages,
    );
  }
}

function countTitleCandidates(
  items: SearchItem[],
  excluded: Set<string>,
  { limit, strategy, languages }: TitleCount,
): KeywordSuggestion[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const texts = new Set(
      extractCandidates({ title: item.title }, languages).map(
        (candidate) => candidate.text,
      ),
    );
    for (const text of texts) {
      if (excluded.has(text)) {
        continue;
      }
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([text, usedByCount]) => ({ text, strategy, usedByCount }));
}
