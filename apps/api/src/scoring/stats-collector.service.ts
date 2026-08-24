import { normalizeText } from '@asobeast/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import {
  SearchItem,
  StoreProvider,
  SuggestItem,
} from '../store-providers/types';
import { KeywordStats } from './formulas';
import { ScoringEvidence } from './provenance';

const SEARCH_DEPTH = 100;
const TOP_STRENGTH = 10;
const TITLE_MATCH_DEPTH = 30;
const PREFIX_PROBE_CAP = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CollectedKeywordStats {
  stats: KeywordStats;
  evidence: ScoringEvidence;
}

interface SuggestCollection {
  items: SuggestItem[];
  completed: boolean;
}

interface DetailCollection {
  items: KeywordStats['top10'];
  targetCount: number;
  successCount: number;
}

@Injectable()
export class StatsCollectorService {
  private readonly logger = new Logger(StatsCollectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async collect(keywordId: string): Promise<CollectedKeywordStats | null> {
    const keyword = await this.prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { text: true, store: true, country: true },
    });
    if (!keyword) {
      return null;
    }

    const provider = this.registry.get(keyword.store);
    const results = await provider.search(
      keyword.text,
      keyword.country,
      SEARCH_DEPTH,
    );
    const top30TitleMatchCount = this.countTitleMatches(results, keyword.text);

    if (keyword.store === Store.GOOGLE_PLAY) {
      const details = await this.enrichTop10(
        provider,
        results,
        keyword.country,
      );
      const prefixHitLength = await this.probePrefix(
        provider,
        keyword.text,
        keyword.country,
      );
      return {
        stats: {
          store: keyword.store,
          keywordText: keyword.text,
          top10: details.items,
          top30TitleMatchCount,
          suggest: { prefixHitLength },
        },
        evidence: {
          searchResultCount: results.length,
          suggestCompleted: false,
          prefixSweepCompleted: true,
          detailTargetCount: details.targetCount,
          detailSuccessCount: details.successCount,
        },
      };
    }

    const suggestions = await this.collectSuggestions(
      keyword.store,
      keyword.text,
      keyword.country,
    );

    return {
      stats: {
        store: keyword.store,
        keywordText: keyword.text,
        top10: results
          .slice(0, TOP_STRENGTH)
          .map((item) => this.toStrength(item)),
        top30TitleMatchCount,
        suggest: this.toSuggest(suggestions.items, keyword.text),
      },
      evidence: {
        searchResultCount: results.length,
        suggestCompleted: suggestions.completed,
        prefixSweepCompleted: false,
        detailTargetCount: 0,
        detailSuccessCount: 0,
      },
    };
  }

  private async enrichTop10(
    provider: StoreProvider,
    results: SearchItem[],
    country: string,
  ): Promise<DetailCollection> {
    const targets = results.slice(0, TOP_STRENGTH);
    const enriched: KeywordStats['top10'] = [];
    for (const item of targets) {
      try {
        const app = await provider.getApp(item.storeAppId, country);
        enriched.push({
          title: app.title,
          ...(app.ratingCount === undefined
            ? {}
            : { ratingCount: app.ratingCount }),
          ...(app.ratingAvg === undefined ? {} : { ratingAvg: app.ratingAvg }),
          ...(app.storeUpdatedAt === undefined
            ? {}
            : { daysSinceUpdate: daysSince(app.storeUpdatedAt) }),
          ...(app.installs === undefined
            ? {}
            : { installs: Number(app.installs) }),
        });
      } catch (error) {
        this.logger.warn(
          `detail lookup failed for "${item.storeAppId}", dropping it: ${messageOf(error)}`,
        );
      }
    }
    return {
      items: enriched,
      targetCount: targets.length,
      successCount: enriched.length,
    };
  }

  private async probePrefix(
    provider: StoreProvider,
    text: string,
    country: string,
  ): Promise<number | null> {
    const target = normalizeText(text);
    const maxLength = Math.min(text.length, PREFIX_PROBE_CAP);
    for (let length = 1; length <= maxLength; length += 1) {
      const suggestions = await provider.suggest(
        text.slice(0, length),
        country,
      );
      if (suggestions.some((item) => normalizeText(item.term) === target)) {
        return length;
      }
    }
    return null;
  }

  private async collectSuggestions(
    store: Store,
    text: string,
    country: string,
  ): Promise<SuggestCollection> {
    try {
      return {
        items: await this.registry.get(store).suggest(text, country),
        completed: true,
      };
    } catch (error) {
      this.logger.warn(
        `suggest failed, scoring without it: ${messageOf(error)}`,
      );
      return { items: [], completed: false };
    }
  }

  private toStrength(item: SearchItem): KeywordStats['top10'][number] {
    return {
      title: item.title,
      ...(item.ratingCount === undefined
        ? {}
        : { ratingCount: item.ratingCount }),
      ...(item.ratingAvg === undefined ? {} : { ratingAvg: item.ratingAvg }),
      ...(item.updatedAt === undefined
        ? {}
        : { daysSinceUpdate: daysSince(item.updatedAt) }),
    };
  }

  private countTitleMatches(results: SearchItem[], text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return results.slice(0, TITLE_MATCH_DEPTH).filter((item) => {
      const title = item.title.toLowerCase();
      return words.every((word) => title.includes(word));
    }).length;
  }

  private toSuggest(
    suggestions: { term: string; priority?: number }[],
    text: string,
  ): KeywordStats['suggest'] {
    const target = text.toLowerCase();
    const exact = suggestions.find(
      (item) => item.term.toLowerCase() === target,
    );
    if (exact) {
      return exact.priority === undefined ? {} : { priority: exact.priority };
    }

    const partial = suggestions
      .filter((item) => item.term.toLowerCase().includes(target))
      .reduce<number | undefined>((best, item) => {
        if (item.priority === undefined) {
          return best;
        }
        return best === undefined || item.priority > best
          ? item.priority
          : best;
      }, undefined);

    return partial === undefined ? {} : { partialPriority: partial };
  }
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
