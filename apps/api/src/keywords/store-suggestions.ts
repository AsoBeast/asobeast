import { Injectable } from '@nestjs/common';
import { KeywordSource } from '@prisma/client';
import {
  KeywordSuggestion,
  normalizeText,
  StoreSuggestionStrategy,
} from '@asobeast/shared';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { developerId } from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import { extractCandidates } from './extraction';
import { loadKeywordFieldIndex, reportedSource } from './keyword-field-index';
import { SuggestionRequest } from './suggestion-request';

const SEARCH_SEED_LIMIT = 5;

const SOURCE_WEIGHT: Record<KeywordSource, number> = {
  KEYWORD_FIELD: 4,
  TITLE: 3,
  SUBTITLE: 2,
  MANUAL: 2,
  SUGGESTED: 1,
  DESCRIPTION: 1,
  COMPETITOR: 1,
};

interface TitleCount {
  limit: number;
  strategy: 'similar' | 'developer';
  languages: readonly string[];
}

@Injectable()
export class StoreSuggestions {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  suggest(
    strategy: StoreSuggestionStrategy,
    request: SuggestionRequest,
  ): Promise<KeywordSuggestion[]> {
    switch (strategy) {
      case 'search':
        return this.suggestFromSearch(request);
      case 'similar':
        return this.suggestFromSimilar(request);
      case 'developer':
        return this.suggestFromDeveloper(request);
    }
  }

  private async suggestFromSearch({
    appId,
    market,
    tracked,
    limit,
  }: SuggestionRequest): Promise<KeywordSuggestion[]> {
    const provider = this.registry.get(market.store);
    const seeds = await this.searchSeeds(appId);
    const seedSet = new Set(seeds);
    const merged = new Map<string, number | undefined>();

    for (const seed of seeds) {
      const items = await provider.suggest(seed, market.country);
      for (const item of items) {
        const text = normalizeText(item.term);
        if (!text || tracked.has(text) || seedSet.has(text)) {
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
    const inField = await loadKeywordFieldIndex(this.prisma, appId);
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: {
        source: true,
        keyword: { select: { text: true, country: true } },
      },
    });
    const weight = (row: (typeof tracked)[number]) =>
      SOURCE_WEIGHT[
        reportedSource(
          row.source,
          inField(row.keyword.country, row.keyword.text),
        )
      ];
    return tracked
      .sort((a, b) => weight(b) - weight(a))
      .slice(0, SEARCH_SEED_LIMIT)
      .map((row) => row.keyword.text);
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
