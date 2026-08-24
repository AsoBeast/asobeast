import { Injectable } from '@nestjs/common';
import { Store } from '@asobeast/shared';
import { CategoryBucket } from '../category-ranks/category-ranks.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AppTarget {
  id: string;
  store: Store;
}

export interface KeywordTarget {
  keywordId: string;
  store: Store;
}

export interface DailyTargets {
  apps: AppTarget[];
  keywords: KeywordTarget[];
  reviewApps: AppTarget[];
}

@Injectable()
export class DailyTargetsCollector {
  constructor(private readonly prisma: PrismaService) {}

  async collect(): Promise<DailyTargets> {
    const apps = await this.prisma.app.findMany({
      select: { id: true, isCompetitor: true, store: true },
    });
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true },
      select: { keywordId: true, keyword: { select: { store: true } } },
      distinct: ['keywordId'],
    });

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
    };
  }
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
