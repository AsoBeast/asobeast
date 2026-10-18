import { Injectable } from '@nestjs/common';
import {
  assertStorefront,
  isStoreSuggestionStrategy,
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  StoreSuggestionStrategy,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { extractCandidates } from './extraction';
import { ensureApp, trackedTexts } from './keywords.support';
import { listingLanguages } from './listing-languages';
import { mineReviewPhrases } from './review-mining';
import { seasonalSuggestions } from './seasonal-suggestions';
import { StoreSuggestions } from './store-suggestions';
import { SuggestionRequest } from './suggestion-request';
import {
  HOME_LISTING,
  LATEST_HOME_LISTING,
  NEWEST_FIRST,
} from '../apps/listing';

const REVIEW_MINING_CAP = 500;

@Injectable()
export class KeywordSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreSuggestions,
    private readonly egress: ProxyEgress,
  ) {}

  async suggest(
    appId: string,
    strategy: KeywordSuggestionStrategy,
    limit: number,
    country?: string,
    spend?: () => Promise<void>,
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
    if (!isStoreSuggestionStrategy(strategy)) {
      return this.dispatch(strategy, request);
    }
    await spend?.();
    return this.egress.through(market.store, market.country, () =>
      this.store.suggest(strategy, request),
    );
  }

  private dispatch(
    strategy: Exclude<KeywordSuggestionStrategy, StoreSuggestionStrategy>,
    request: SuggestionRequest,
  ): Promise<KeywordSuggestion[]> {
    const { appId, limit, tracked, market, languages } = request;
    if (strategy === 'competitors') {
      return this.suggestFromCompetitors(appId, tracked, limit, languages.home);
    }
    if (strategy === 'seasonal') {
      return Promise.resolve(
        seasonalSuggestions(new Date(), market.country, tracked, limit),
      );
    }
    if (strategy === 'reviews') {
      return this.suggestFromReviews(appId, tracked, limit, languages.home);
    }
    return this.suggestFromMetadata(appId, tracked, limit, languages.home);
  }

  private async suggestFromReviews(
    appId: string,
    excluded: Set<string>,
    limit: number,
    languages: readonly string[],
  ): Promise<KeywordSuggestion[]> {
    const reviews = await this.prisma.review.findMany({
      where: { appId },
      orderBy: { reviewedAt: 'desc' },
      take: REVIEW_MINING_CAP,
      select: { title: true, text: true },
    });
    return mineReviewPhrases(reviews, excluded, languages).slice(0, limit);
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
