import { Injectable } from '@nestjs/common';
import { Store } from '@asobeast/shared';
import { CategoryBucket } from '../category-ranks/category-ranks.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackedMarketRow, trackedMarkets } from './tracked-markets';

export interface AppTarget {
  id: string;
  store: Store;
}

export interface KeywordTarget {
  keywordId: string;
  store: Store;
}

export interface MarketListingTarget {
  id: string;
  store: Store;
  country: string;
}

export interface DailyTargets {
  apps: AppTarget[];
  keywords: KeywordTarget[];
  reviewApps: AppTarget[];
  marketListings: MarketListingTarget[];
}

interface ListedApp {
  id: string;
  store: Store;
  primaryAppId: string | null;
}

@Injectable()
export class DailyTargetsCollector {
  constructor(private readonly prisma: PrismaService) {}

  async collect(): Promise<DailyTargets> {
    const apps = await this.prisma.app.findMany({
      select: {
        id: true,
        isCompetitor: true,
        store: true,
        primaryAppId: true,
      },
    });
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true },
      select: { keywordId: true, keyword: { select: { store: true } } },
      distinct: ['keywordId'],
    });
    const markets = await trackedMarkets(this.prisma);

    return {
      apps: apps.map((app) => ({ id: app.id, store: app.store })),
      keywords: dedupeKeywords(
        keywords.map((keyword) => ({
          keywordId: keyword.keywordId,
          store: keyword.keyword.store,
        })),
      ),
      reviewApps: apps
        .filter((app) => !app.isCompetitor)
        .map((app) => ({ id: app.id, store: app.store })),
      marketListings: marketListingTargets(apps, markets),
    };
  }
}

export function marketListingTargets(
  apps: readonly ListedApp[],
  markets: readonly TrackedMarketRow[],
): MarketListingTarget[] {
  const seen = new Set<string>();
  return markets.flatMap(({ appId, country }) =>
    apps
      .filter((app) => app.id === appId || app.primaryAppId === appId)
      .filter((app) => {
        const key = `${app.id}~${country}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((app) => ({ id: app.id, store: app.store, country })),
  );
}

interface AppFamily {
  id: string;
  store: Store;
  country: string;
  competitors: ReadonlyArray<{ id: string; store: Store }>;
  tracked: ReadonlyArray<{ keyword: { country: string } }>;
}

export function appFamilyMarketListings(app: AppFamily): MarketListingTarget[] {
  return marketListingTargets(
    [
      { id: app.id, store: app.store, primaryAppId: null },
      ...app.competitors.map((rival) => ({
        id: rival.id,
        store: rival.store,
        primaryAppId: app.id,
      })),
    ],
    [...new Set(app.tracked.map((row) => row.keyword.country))]
      .filter((country) => country !== app.country)
      .map((country) => ({ appId: app.id, country })),
  );
}

export function dedupeKeywords(keywords: KeywordTarget[]): KeywordTarget[] {
  const seen = new Map<string, KeywordTarget>();
  for (const keyword of keywords) {
    if (!seen.has(keyword.keywordId)) seen.set(keyword.keywordId, keyword);
  }
  return [...seen.values()];
}

export function dedupeBuckets<T extends CategoryBucket>(buckets: T[]): T[] {
  const seen = new Map<string, T>();
  for (const bucket of buckets) {
    const key = [
      bucket.store,
      bucket.collection,
      bucket.genre,
      bucket.country,
    ].join('~');
    if (!seen.has(key)) seen.set(key, bucket);
  }
  return [...seen.values()];
}
