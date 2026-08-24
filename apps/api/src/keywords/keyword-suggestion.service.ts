import { Injectable } from '@nestjs/common';
import { KeywordSource, Store } from '@prisma/client';
import {
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
import { ensureApp, trackedTexts } from './keywords.support';
import { mineReviewPhrases } from './review-mining';
import { seasonalSuggestions } from './seasonal-suggestions';

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
    const tracked = await trackedTexts(this.prisma, appId, market.country);

    const work = () => this.dispatch(appId, strategy, limit, market, tracked);
    if (!REACHES_THE_STORE[strategy]) return work();
    return this.egress.through(market.store, market.country, work);
  }

  private dispatch(
    appId: string,
    strategy: KeywordSuggestionStrategy,
    limit: number,
    market: { store: Store; country: string; storeAppId: string },
    tracked: Set<string>,
  ): Promise<KeywordSuggestion[]> {
    if (strategy === 'search') {
      return this.suggestFromSearch(appId, market, tracked, limit);
    }
    if (strategy === 'similar') {
      return this.suggestFromSimilar(market, tracked, limit);
    }
    if (strategy === 'developer') {
      return this.suggestFromDeveloper(appId, market, tracked, limit);
    }
    if (strategy === 'competitors') {
      return this.suggestFromCompetitors(appId, tracked, limit);
    }
    if (strategy === 'seasonal') {
      return Promise.resolve(seasonalSuggestions(new Date(), tracked, limit));
    }
    if (strategy === 'reviews') {
      return this.suggestFromReviews(appId, tracked, limit);
    }
    return this.suggestFromMetadata(appId, tracked, limit);
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
  ): Promise<KeywordSuggestion[]> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      select: {
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
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
        extractCandidates({
          title: snapshot.title,
          subtitle: snapshot.subtitle ?? undefined,
        }).map((candidate) => candidate.text),
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
  ): Promise<KeywordSuggestion[]> {
    const candidates = await this.latestCandidates(appId);
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

  private async suggestFromSimilar(
    app: { store: Store; country: string; storeAppId: string },
    excluded: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const provider = this.registry.get(app.store);
    const similar = await provider.similar(app.storeAppId, app.country);
    return countTitleCandidates(similar, excluded, limit, 'similar');
  }

  private async suggestFromDeveloper(
    appId: string,
    app: { store: Store; country: string },
    tracked: Set<string>,
    limit: number,
  ): Promise<KeywordSuggestion[]> {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { raw: true, title: true },
    });
    const devId = snapshot && developerId(app.store, snapshot.raw);
    if (!devId) {
      return [];
    }

    const excluded = new Set(tracked);
    for (const candidate of extractCandidates({ title: snapshot.title })) {
      excluded.add(candidate.text);
    }

    const provider = this.registry.get(app.store);
    const apps = await provider.developerApps(devId, app.country);
    return countTitleCandidates(apps, excluded, limit, 'developer');
  }

  private async searchSeeds(appId: string): Promise<string[]> {
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: { source: true, keyword: { select: { text: true } } },
    });
    return tracked
      .sort((a, b) => SOURCE_WEIGHT[b.source] - SOURCE_WEIGHT[a.source])
      .slice(0, SEARCH_SEED_LIMIT)
      .map((row) => row.keyword.text);
  }

  private async latestCandidates(appId: string) {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return [];
    }
    return extractCandidates({
      title: snapshot.title,
      subtitle: snapshot.subtitle ?? undefined,
      summary: snapshot.summary ?? undefined,
    });
  }
}

function countTitleCandidates(
  items: SearchItem[],
  excluded: Set<string>,
  limit: number,
  strategy: 'similar' | 'developer',
): KeywordSuggestion[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const texts = new Set(
      extractCandidates({ title: item.title }).map(
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
