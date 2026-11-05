import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { outcomeOf } from '../store-providers/egress/proxy-health.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import {
  SearchItem,
  StoreProvider,
  SuggestItem,
} from '../store-providers/types';
import { inferPopularityGenre } from './apple-genres';
import { KeywordStats } from './formulas';
import { OfficialPopularityLookup } from './official-popularity';
import { officialEvidence } from './official-signals';
import { ScoringEvidence } from './provenance';
import { EVIDENCE_ALL_WORDS, titleEvidence } from './serp-signals';
import { SuggestReach } from './suggest-reach';
import {
  countContinuations,
  countingLookup,
  probeSuggestReach,
  SUGGEST_MATCH,
} from './suggest-reach.probe';

const SEARCH_DEPTH = 100;
const TOP_STRENGTH = 10;
const COMPETITOR_DEPTH = 25;
const TITLE_MATCH_DEPTH = 30;
export const MIN_DETAIL_SUCCESS_SHARE = 0.5;
const MIN_JUDGED_DETAILS = 3;
const STORE_SERVER_ERROR = /failed with status 5\d\d/;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CollectedKeywordStats {
  stats: KeywordStats;
  evidence: ScoringEvidence;
}

export interface KeywordTarget {
  text: string;
  store: Store;
  country: string;
}

export interface InspectedKeywordStats extends CollectedKeywordStats {
  results: SearchItem[];
  suggestions: SuggestItem[];
}

interface SuggestSignals {
  reach: SuggestReach;
  continuations: number | null;
  requests: number;
  suggestions: SuggestItem[];
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
    const { stats, evidence } = await this.collectFor(keyword);
    return { stats, evidence };
  }

  async collectFor(keyword: KeywordTarget): Promise<InspectedKeywordStats> {
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
    const { reach, continuations, requests, suggestions } =
      await this.suggestSignals(provider, keyword);
    const suggestCompleted = reach.status !== 'unavailable';
    const official = await this.officialPopularity.for(
      keyword,
      inferPopularityGenre(results),
    );

    return {
      results,
      suggestions,
      stats: {
        store: keyword.store,
        keywordText: keyword.text,
        resultCount: results.length,
        top10: topTen.items,
        ...(keyword.store === Store.APP_STORE
          ? {
              competitors: results
                .slice(0, COMPETITOR_DEPTH)
                .map((item) => this.toStrength(item)),
            }
          : {}),
        top30TitleMatchCount: this.countTitleMatches(results, keyword.text),
        suggest: reach,
        ...(continuations === null ? {} : { continuations }),
        ...(official ? { official } : {}),
      },
      evidence: {
        searchResultCount: results.length,
        suggestCompleted,
        suggestRequests: requests,
        detailTargetCount: topTen.targetCount,
        detailSuccessCount: topTen.successCount,
        officialPopularityUsed: official !== undefined && 'value' in official,
        ...officialEvidence(official),
      },
    };
  }

  private async suggestSignals(
    provider: StoreProvider,
    { text, store, country }: KeywordTarget,
  ): Promise<SuggestSignals> {
    const lookup = countingLookup((term) => provider.suggest(term, country));
    const { reach } = await probeSuggestReach(
      text,
      lookup.ask,
      SUGGEST_MATCH[store],
    );
    if (reach.status === 'unavailable' && store === Store.GOOGLE_PLAY) {
      this.logger.warn(
        `suggest unavailable for "${text}", scoring on demand only`,
      );
    }
    const continuations =
      store === Store.APP_STORE
        ? await countContinuations(text, lookup.ask)
        : null;
    const suggestions =
      reach.status === 'unavailable' ? [] : await offered(lookup.ask, text);
    return { reach, continuations, requests: lookup.requests(), suggestions };
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
    let unanswered = 0;
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
          ...(app.releasedAt === undefined
            ? {}
            : { daysSinceRelease: daysSince(app.releasedAt) }),
          ...(app.installs === undefined
            ? {}
            : { installs: Number(app.installs) }),
        });
      } catch (error) {
        this.logger.warn(
          `detail lookup failed for "${item.storeAppId}", keeping its search entry: ${messageOf(error)}`,
        );
        failed += 1;
        if (storeDidNotAnswer(error)) unanswered += 1;
        enriched.push(this.toStrength(item));
      }
    }
    const successCount = targets.length - failed;
    if (
      (targets.length >= MIN_JUDGED_DETAILS || unanswered > 0) &&
      successCount < targets.length * MIN_DETAIL_SUCCESS_SHARE
    ) {
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
      ...(item.releasedAt === undefined
        ? {}
        : { daysSinceRelease: daysSince(item.releasedAt) }),
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

function storeDidNotAnswer(error: unknown): boolean {
  return outcomeOf(error) !== null || STORE_SERVER_ERROR.test(messageOf(error));
}

async function offered(
  ask: (term: string) => Promise<SuggestItem[]>,
  text: string,
): Promise<SuggestItem[]> {
  try {
    return await ask(text);
  } catch {
    return [];
  }
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
