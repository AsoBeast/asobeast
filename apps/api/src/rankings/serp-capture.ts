import { Injectable, Logger } from '@nestjs/common';
import { KeywordScope, RANK_DEPTH, SERP_CAPTURE_DEPTH } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import {
  askAgainWhileEmpty,
  EMPTY_ANSWER_RETRIES,
  isImplausiblyEmpty,
  settleOnLastAttempt,
} from '../store-providers/result-plausibility';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SearchItem } from '../store-providers/types';
import { toDateKey, utcToday } from './rankings.support';

export interface SerpEntryRow {
  keywordId: string;
  date: Date;
  position: number;
  storeAppId: string;
  title: string;
  developer: string | null;
  iconUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
}

export function positionsByStoreAppId(
  results: readonly SearchItem[],
): Map<string, number> {
  const positions = new Map<string, number>();
  results.forEach((item, index) => {
    if (!positions.has(item.storeAppId)) {
      positions.set(item.storeAppId, index + 1);
    }
  });
  return positions;
}

export function serpEntryRows(
  keywordId: string,
  date: Date,
  results: readonly SearchItem[],
): SerpEntryRow[] {
  return results.slice(0, SERP_CAPTURE_DEPTH).map((item, index) => ({
    keywordId,
    date,
    position: index + 1,
    storeAppId: item.storeAppId,
    title: item.title,
    developer: item.developer ?? null,
    iconUrl: item.iconUrl ?? null,
    ratingAvg: item.ratingAvg ?? null,
    ratingCount: item.ratingCount ?? null,
  }));
}

@Injectable()
export class SerpCapture {
  private readonly logger = new Logger(SerpCapture.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async search(
    keyword: KeywordScope,
    finalAttempt: boolean,
  ): Promise<SearchItem[] | null> {
    const provider = this.registry.get(keyword.store);
    const ask = () =>
      provider.search(keyword.text, keyword.country, RANK_DEPTH);
    const results = await ask();
    if (results.length > 0) return results;

    const today = utcToday();
    const lastRanked = await this.prisma.serpEntry.findFirst({
      where: { keywordId: keyword.id, date: { lt: today } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (
      !lastRanked ||
      !isImplausiblyEmpty({
        resultCount: 0,
        lastSeenOn: lastRanked.date,
        today,
      })
    ) {
      return results;
    }
    const retries = EMPTY_ANSWER_RETRIES[keyword.store];
    const again = await askAgainWhileEmpty(ask, retries, results);
    if (again.length > 0) return again;
    return settleOnLastAttempt(
      new ImplausibleResultError(
        keyword.store,
        `"${keyword.text}" returned no results in ${keyword.country} but ranked apps on ${toDateKey(lastRanked.date)}`,
        { retryable: retries > 0 },
      ),
      { finalAttempt, logger: this.logger, next: 'check', settled: null },
    );
  }

  async store(
    keywordId: string,
    date: Date,
    results: readonly SearchItem[],
  ): Promise<SerpEntryRow[]> {
    const rows = serpEntryRows(keywordId, date, results);
    await this.prisma.withTransaction(async (tx) => {
      await tx.serpEntry.deleteMany({ where: { keywordId, date } });
      await tx.serpEntry.createMany({ data: rows });
    });
    return rows;
  }
}
