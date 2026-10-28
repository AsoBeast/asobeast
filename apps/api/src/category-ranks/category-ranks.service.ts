import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CATEGORY_COLLECTIONS,
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
import { ChartCaptureService } from '../charts/chart-capture.service';
import { chartKeyOf } from '../charts/chart-key';
import { CheckCategoryPayload } from '../jobs/jobs.types';
import { CategoryRankHistoryQueryDto } from './dto/category-rank-history-query.dto';
import { LATEST_HOME_LISTING } from '../apps/listing';
import { type ChartRef, isRankedIn, rankedChartsOf } from './ranked-charts';
import { ChartAlertsService } from './chart-alerts.service';
import { chartMoveScope } from './chart-move-scope';

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
  name: string | null;
  isCompetitor: boolean;
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
    for (const collection of CATEGORY_COLLECTIONS) {
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
    private readonly charts: ChartCaptureService,
    private readonly chartAlerts: ChartAlertsService,
  ) {}

  async buckets(appIds: string[]): Promise<CategoryBucket[]> {
    return bucketsOf(await this.loadAppBuckets({ id: { in: appIds } }));
  }

  async rankedCharts(appId: string): Promise<ChartRef[]> {
    const rows = await this.loadAppBuckets({ id: appId });
    return rows.flatMap(rankedChartsOf);
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

  async checkCategory(
    payload: CheckCategoryPayload,
    finalAttempt: boolean,
  ): Promise<void> {
    const { collection, genre, country, store } = payload;
    const key = chartKeyOf({ collection, genre, country, store });
    const chart = await this.charts.captureToday(key, { finalAttempt });
    const positionByStoreAppId = new Map(
      chart.entries.map((entry) => [entry.storeAppId, entry.position]),
    );
    const scope = chartMoveScope(key);

    const rows = await this.loadAppBuckets({ store, country });
    const date = utcToday();
    for (const row of rows) {
      if (!isRankedIn(row, { collection, genre })) {
        continue;
      }
      const position = positionByStoreAppId.get(row.storeAppId) ?? null;
      const changed = await this.record(row, {
        collection,
        genre,
        date,
        position,
        depth: chart.depth,
      });
      if (changed && chart.entries.length > 0 && !row.isCompetitor) {
        await this.chartAlerts.dispatch({
          app: { id: row.id, name: row.name },
          chart: scope,
          date,
          position,
          depth: chart.depth,
        });
      }
    }
  }

  private async record(
    row: AppBucketRow,
    rank: {
      collection: CategoryCollection;
      genre: string;
      date: Date;
      position: number | null;
      depth: number;
    },
  ): Promise<boolean> {
    const { collection, genre, date, position, depth } = rank;
    const where = {
      appId_date_collection_genre: { appId: row.id, date, collection, genre },
    };
    const existing = await this.prisma.categoryRank.findUnique({
      where,
      select: { position: true },
    });
    await this.prisma.categoryRank.upsert({
      where,
      create: { appId: row.id, date, collection, genre, position, depth },
      update: { position, depth },
    });
    return existing === null || existing.position !== position;
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
          ...LATEST_HOME_LISTING,
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
      select: {
        collection: true,
        genre: true,
        date: true,
        position: true,
        depth: true,
      },
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
      item.depth = rank.depth;
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
        name: true,
        isCompetitor: true,
        workspaceId: true,
        storeAppId: true,
        country: true,
        store: true,
        snapshots: {
          ...LATEST_HOME_LISTING,
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
        name: app.name,
        isCompetitor: app.isCompetitor,
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
