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
import { seasonalSuggestions } from './seasonal-suggestions';
import { StoreSuggestions } from './store-suggestions';
import { competitorPhrases, recentReviewPhrases } from './suggestion-phrases';
import { SuggestionRequest } from './suggestion-request';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';

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
    const lookup = await this.store.plan(strategy, request);
    if (!lookup) return [];
    await spend?.();
    return this.egress.through(market.store, market.country, lookup, {
      waitForLocal: false,
    });
  }

  private dispatch(
    strategy: Exclude<KeywordSuggestionStrategy, StoreSuggestionStrategy>,
    request: SuggestionRequest,
  ): Promise<KeywordSuggestion[]> {
    const { appId, limit, tracked, market, languages } = request;
    if (strategy === 'competitors') {
      return competitorPhrases(
        this.prisma,
        appId,
        tracked,
        languages.home,
        limit,
      );
    }
    if (strategy === 'seasonal') {
      return Promise.resolve(
        seasonalSuggestions(new Date(), market.country, tracked, limit),
      );
    }
    if (strategy === 'reviews') {
      return recentReviewPhrases(
        this.prisma,
        appId,
        tracked,
        languages.home,
        limit,
      );
    }
    return this.suggestFromMetadata(appId, tracked, limit, languages.home);
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
