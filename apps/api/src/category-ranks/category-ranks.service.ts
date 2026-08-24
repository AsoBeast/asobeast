import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoryCollection,
  CategoryRankSeries,
  CategoryRankSeriesItem,
  OVERALL_GENRE,
} from '@asobeast/shared';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isPaid,
  primaryGenreKey,
  primaryGenreName,
} from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { CheckCategoryPayload } from '../jobs/jobs.types';
import { CategoryRankHistoryQueryDto } from './dto/category-rank-history-query.dto';

const CHART_DEPTH = 200;
const DEFAULT_HISTORY_DAYS = 90;
const MAX_HISTORY_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CategoryBucket {
  collection: CategoryCollection;
  genre: string;
  country: string;
  store: Store;
}

interface AppBucketRow {
  id: string;
  workspaceId: string;
  storeAppId: string;
  country: string;
  store: Store;
  collections: CategoryCollection[];
  genre: string;
}

function bucketsOf(rows: AppBucketRow[]): CategoryBucket[] {
  const seen = new Set<string>();
  const buckets: CategoryBucket[] = [];
  for (const row of rows) {
    for (const collection of row.collections) {
      for (const genre of [row.genre, OVERALL_GENRE]) {
        const key = `${row.store}:${collection}:${genre}:${row.country}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        buckets.push({
          collection,
          genre,
          country: row.country,
          store: row.store,
        });
      }
    }
  }
  return buckets;
}

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class CategoryRanksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async buckets(appIds: string[]): Promise<CategoryBucket[]> {
    return bucketsOf(await this.loadAppBuckets({ id: { in: appIds } }));
  }

  async bucketsByWorkspace(): Promise<Map<string, CategoryBucket[]>> {
    const rows = await this.loadAppBuckets({});
    const byWorkspace = new Map<string, AppBucketRow[]>();
    for (const row of rows) {
      const group = byWorkspace.get(row.workspaceId);
      if (group) group.push(row);
      else byWorkspace.set(row.workspaceId, [row]);
    }
    return new Map(
      [...byWorkspace].map(([workspaceId, group]) => [
        workspaceId,
        bucketsOf(group),
      ]),
    );
  }

  async checkCategory(payload: CheckCategoryPayload): Promise<void> {
    const { collection, genre, country, store } = payload;
    const items = await this.registry
      .get(store)
      .topCharts(collection, genre, CHART_DEPTH, country);

    const positionByStoreAppId = new Map<string, number>();
    items.forEach((item, index) => {
      if (!positionByStoreAppId.has(item.storeAppId)) {
        positionByStoreAppId.set(item.storeAppId, index + 1);
      }
    });

    const rows = await this.loadAppBuckets({ store, country });
    const date = utcToday();
    for (const row of rows) {
      const matches =
        row.collections.includes(collection) &&
        (genre === OVERALL_GENRE || row.genre === genre);
      if (!matches) {
        continue;
      }
      const position = positionByStoreAppId.get(row.storeAppId) ?? null;
      await this.prisma.categoryRank.upsert({
        where: {
          appId_date_collection_genre: {
            appId: row.id,
            date,
            collection,
            genre,
          },
        },
        create: {
          appId: row.id,
          date,
          collection,
          genre,
          position,
          depth: CHART_DEPTH,
        },
        update: { position, depth: CHART_DEPTH },
      });
    }
  }

  async history(
    appId: string,
    query: CategoryRankHistoryQueryDto,
  ): Promise<CategoryRankSeries> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        store: true,
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { raw: true },
        },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const to = query.to ? new Date(query.to) : utcToday();
    const earliest = new Date(to.getTime() - MAX_HISTORY_DAYS * DAY_MS);
    const requestedFrom = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_HISTORY_DAYS * DAY_MS);
    const from = requestedFrom < earliest ? earliest : requestedFrom;

    const ranks = await this.prisma.categoryRank.findMany({
      where: { appId, date: { gte: from, lte: to } },
      orderBy: [{ collection: 'asc' }, { genre: 'asc' }, { date: 'asc' }],
      select: { collection: true, genre: true, date: true, position: true },
    });

    const genreName = primaryGenreName(app.store, app.snapshots[0]?.raw);
    const groups = new Map<string, CategoryRankSeriesItem>();
    for (const rank of ranks) {
      const key = `${rank.collection}:${rank.genre}`;
      let item = groups.get(key);
      if (!item) {
        item = {
          collection: rank.collection as CategoryCollection,
          genre: rank.genre,
          genreName:
            rank.genre === OVERALL_GENRE ? 'Overall' : (genreName ?? 'Unknown'),
          current: null,
          points: [],
        };
        groups.set(key, item);
      }
      item.points.push({ date: toDateKey(rank.date), position: rank.position });
      item.current = rank.position;
    }

    return { series: [...groups.values()] };
  }

  private async loadAppBuckets(
    where: Record<string, unknown>,
  ): Promise<AppBucketRow[]> {
    const apps = await this.prisma.app.findMany({
      where,
      select: {
        id: true,
        workspaceId: true,
        storeAppId: true,
        country: true,
        store: true,
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { raw: true },
        },
      },
    });

    const rows: AppBucketRow[] = [];
    for (const app of apps) {
      const snapshot = app.snapshots[0];
      if (!snapshot) {
        continue;
      }
      const genre = primaryGenreKey(app.store, snapshot.raw);
      if (genre === null) {
        continue;
      }
      rows.push({
        id: app.id,
        workspaceId: app.workspaceId,
        storeAppId: app.storeAppId,
        country: app.country,
        store: app.store,
        collections: [isPaid(snapshot.raw) ? 'paid' : 'free', 'grossing'],
        genre,
      });
    }
    return rows;
  }
}
