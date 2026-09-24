import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem, StoreProvider } from '../store-providers/types';
import { inferPopularityGenre } from './apple-genres';
import { KeywordStats, SerpApp, TOP_TEN } from './formulas';
import { OfficialPopularityLookup } from './official-popularity';
import { ScoringEvidence } from './provenance';
import {
  ProbedReach,
  probeSuggestReach,
  SUGGEST_MATCH,
} from './suggest-reach.probe';

const SEARCH_DEPTH = 100;
const COMPETITOR_DEPTH = 25;
export const MIN_DETAIL_SUCCESS_SHARE = 0.5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CollectedKeywordStats {
  stats: KeywordStats;
  evidence: ScoringEvidence;
}

interface DetailCollection {
  items: SerpApp[];
  targetCount: number;
  successCount: number;
}

@Injectable()
export class StatsCollectorService {
  private readonly logger = new Logger(StatsCollectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly officialPopularity: OfficialPopularityLookup,
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
    const serp =
      keyword.store === Store.GOOGLE_PLAY
        ? await this.enrichTop10(provider, results, keyword.country)
        : this.searchPage(results);
    const { reach, requests } = await this.suggestReach(provider, keyword);
    const suggestCompleted = reach.status !== 'unavailable';
    const official = await this.officialPopularity.for(
      keyword,
      inferPopularityGenre(results),
    );

    return {
      stats: {
        store: keyword.store,
        keywordText: keyword.text,
        resultCount: results.length,
        serp: serp.items,
        suggest: reach,
        ...(official ? { official } : {}),
      },
      evidence: {
        searchResultCount: results.length,
        suggestCompleted,
        suggestRequests: requests,
        detailTargetCount: serp.targetCount,
        detailSuccessCount: serp.successCount,
        officialPopularityUsed: official !== undefined && 'value' in official,
      },
    };
  }

  private async suggestReach(
    provider: StoreProvider,
    { text, store, country }: { text: string; store: Store; country: string },
  ): Promise<ProbedReach> {
    const probed = await probeSuggestReach(
      text,
      (term) => provider.suggest(term, country),
      SUGGEST_MATCH[store],
    );
    if (probed.reach.status === 'unavailable' && store === Store.GOOGLE_PLAY) {
      this.logger.warn(
        `suggest unavailable for "${text}", scoring on demand only`,
      );
    }
    return probed;
  }

  private searchPage(results: SearchItem[]): DetailCollection {
    const topCount = Math.min(results.length, TOP_TEN);
    return {
      items: results
        .slice(0, COMPETITOR_DEPTH)
        .map((item) => this.toStrength(item)),
      targetCount: topCount,
      successCount: topCount,
    };
  }

  private async enrichTop10(
    provider: StoreProvider,
    results: SearchItem[],
    country: string,
  ): Promise<DetailCollection> {
    const targets = results.slice(0, TOP_TEN);
    const enriched: SerpApp[] = [];
    let failed = 0;
    for (const item of targets) {
      try {
        const app = await provider.getApp(item.storeAppId, country);
        enriched.push({
          ...identityOf(item),
          title: app.title,
          ...(app.ratingCount === undefined
            ? {}
            : { ratingCount: app.ratingCount }),
          ...(app.ratingAvg === undefined ? {} : { ratingAvg: app.ratingAvg }),
          ...(app.releasedAt === undefined
            ? {}
            : { daysSinceRelease: daysSince(app.releasedAt) }),
        });
      } catch (error) {
        this.logger.warn(
          `detail lookup failed for "${item.storeAppId}", keeping its search entry: ${messageOf(error)}`,
        );
        failed += 1;
        enriched.push(this.toStrength(item));
      }
    }
    const successCount = targets.length - failed;
    if (successCount < targets.length * MIN_DETAIL_SUCCESS_SHARE) {
      throw new Error(
        `only ${successCount} of ${targets.length} detail lookups succeeded`,
      );
    }
    return { items: enriched, targetCount: targets.length, successCount };
  }

  private toStrength(item: SearchItem): SerpApp {
    return {
      ...identityOf(item),
      title: item.title,
      ...(item.ratingCount === undefined
        ? {}
        : { ratingCount: item.ratingCount }),
      ...(item.ratingAvg === undefined ? {} : { ratingAvg: item.ratingAvg }),
      ...(item.releasedAt === undefined
        ? {}
        : { daysSinceRelease: daysSince(item.releasedAt) }),
    };
  }
}

function identityOf(
  item: SearchItem,
): Pick<SerpApp, 'storeAppId' | 'developer'> {
  return {
    storeAppId: item.storeAppId,
    ...(item.developer === undefined ? {} : { developer: item.developer }),
  };
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
