import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem, StoreProvider } from '../store-providers/types';
import { VELOCITY_MIN_DAYS } from './difficulty';
import { KeywordStats } from './formulas';
import { OfficialPopularityLookup } from './official-popularity';
import { ScoringEvidence } from './provenance';
import { readPreviousTop10 } from './score-signals';
import { EVIDENCE_ALL_WORDS, titleEvidence } from './serp-signals';
import {
  ProbedReach,
  probeSuggestReach,
  SUGGEST_MATCH,
} from './suggest-reach.probe';

const SEARCH_DEPTH = 100;
const TOP_STRENGTH = 10;
const TITLE_MATCH_DEPTH = 30;
export const MIN_DETAIL_SUCCESS_SHARE = 0.5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CollectedKeywordStats {
  stats: KeywordStats;
  evidence: ScoringEvidence;
}

type PreviousPage = Pick<
  KeywordStats,
  'previousTop10' | 'previousCapturedDaysAgo'
>;

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
    const topTen =
      keyword.store === Store.GOOGLE_PLAY
        ? await this.enrichTop10(provider, results, keyword.country)
        : this.searchTopTen(results);
    const { reach, requests } = await this.suggestReach(provider, keyword);
    const suggestCompleted = reach.status !== 'unavailable';
    const previous = await this.previousPage(keywordId);
    const official = await this.officialPopularity.for(keyword);

    return {
      stats: {
        store: keyword.store,
        keywordText: keyword.text,
        resultCount: results.length,
        top10: topTen.items,
        top30TitleMatchCount: this.countTitleMatches(results, keyword.text),
        suggest: reach,
        ...previous,
        ...(official ? { official } : {}),
      },
      evidence: {
        searchResultCount: results.length,
        suggestCompleted,
        suggestRequests: requests,
        detailTargetCount: topTen.targetCount,
        detailSuccessCount: topTen.successCount,
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
    if (probed.reach.status === 'unavailable') {
      this.logger.warn(
        `suggest unavailable for "${text}", scoring on demand only`,
      );
    }
    return probed;
  }

  private async previousPage(keywordId: string): Promise<PreviousPage> {
    const todayMs = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    const row = await this.prisma.keywordMetric.findFirst({
      where: {
        keywordId,
        date: { lte: new Date(todayMs - VELOCITY_MIN_DAYS * DAY_MS) },
      },
      orderBy: { date: 'desc' },
      select: { date: true, stats: true },
    });
    const previousTop10 = row ? readPreviousTop10(row.stats) : [];
    if (!row || previousTop10.length === 0) {
      return {};
    }
    return { previousTop10, previousCapturedDaysAgo: daysSince(row.date) };
  }

  private searchTopTen(results: SearchItem[]): DetailCollection {
    const items = results
      .slice(0, TOP_STRENGTH)
      .map((item) => this.toStrength(item));
    return {
      items,
      targetCount: items.length,
      successCount: items.length,
    };
  }

  private async enrichTop10(
    provider: StoreProvider,
    results: SearchItem[],
    country: string,
  ): Promise<DetailCollection> {
    const targets = results.slice(0, TOP_STRENGTH);
    const enriched: KeywordStats['top10'] = [];
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
          ...(app.storeUpdatedAt === undefined
            ? {}
            : { daysSinceUpdate: daysSince(app.storeUpdatedAt) }),
          ...(app.installs === undefined
            ? {}
            : { installs: Number(app.installs) }),
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

  private toStrength(item: SearchItem): KeywordStats['top10'][number] {
    return {
      ...identityOf(item),
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
    return results
      .slice(0, TITLE_MATCH_DEPTH)
      .filter((item) => titleEvidence(item.title, text) >= EVIDENCE_ALL_WORDS)
      .length;
  }
}

function identityOf(
  item: SearchItem,
): Pick<KeywordStats['top10'][number], 'storeAppId' | 'developer'> {
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
