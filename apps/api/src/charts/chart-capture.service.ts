import { Injectable } from '@nestjs/common';
import { CHART_DEPTH, ChartKey } from '@asobeast/shared';
import { Prisma } from '@prisma/client';
import { toDateKey, utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ChartItem } from '../store-providers/types';

export interface ChartAppRow {
  storeAppId: string;
  title: string;
  developer: string | null;
  iconUrl: string | null;
  genreId: string | null;
  free: boolean | null;
}

export interface StoredChart {
  id: string;
  date: Date;
  depth: number;
  capturedAt: Date;
  entries: Array<{ position: number; app: ChartAppRow }>;
}

const WITH_ENTRIES = {
  include: {
    entries: {
      orderBy: { position: 'asc' },
      select: {
        position: true,
        app: {
          select: {
            storeAppId: true,
            title: true,
            developer: true,
            iconUrl: true,
            genreId: true,
            free: true,
          },
        },
      },
    },
  },
} satisfies Pick<Prisma.ChartCaptureFindFirstArgs, 'include'>;

function firstPositions(items: ChartItem[]): Map<string, [number, ChartItem]> {
  const rows = new Map<string, [number, ChartItem]>();
  items.forEach((item, index) => {
    if (!rows.has(item.storeAppId))
      rows.set(item.storeAppId, [index + 1, item]);
  });
  return rows;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class ChartCaptureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async captureToday(key: ChartKey): Promise<StoredChart> {
    const date = utcToday();
    const stored = await this.stored(key, date);
    if (stored) return stored;

    const depth = CHART_DEPTH[key.store];
    const items = await this.registry
      .get(key.store)
      .topCharts(key.collection, key.genre, depth, key.country);
    const entries = [];
    for (const [storeAppId, [position, item]] of firstPositions(items)) {
      entries.push({
        position,
        chartAppId: await this.saveApp(key, storeAppId, item),
      });
    }

    try {
      return await this.prisma.chartCapture.create({
        data: { ...key, date, depth, entries: { create: entries } },
        ...WITH_ENTRIES,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.stored(key, date);
      if (!winner) throw error;
      return winner;
    }
  }

  stored(key: ChartKey, date: Date): Promise<StoredChart | null> {
    return this.prisma.chartCapture.findUnique({
      where: { store_country_collection_genre_device_date: { ...key, date } },
      ...WITH_ENTRIES,
    });
  }

  newestOnOrBefore(key: ChartKey, date: Date): Promise<StoredChart | null> {
    return this.prisma.chartCapture.findFirst({
      where: { ...key, date: { lte: date } },
      orderBy: { date: 'desc' },
      ...WITH_ENTRIES,
    });
  }

  async capturedDates(key: ChartKey, limit: number): Promise<string[]> {
    const rows = await this.prisma.chartCapture.findMany({
      where: key,
      orderBy: { date: 'desc' },
      take: limit,
      select: { date: true },
    });
    return rows.map((row) => toDateKey(row.date));
  }

  private async saveApp(
    key: ChartKey,
    storeAppId: string,
    item: ChartItem,
  ): Promise<string> {
    const listing = {
      title: item.title,
      developer: item.developer,
      iconUrl: item.iconUrl,
      genreId: item.genreId,
      free: item.free,
    };
    const { id } = await this.prisma.chartApp.upsert({
      where: { store_storeAppId: { store: key.store, storeAppId } },
      create: { store: key.store, storeAppId, ...listing },
      update: { ...listing, seenAt: new Date() },
      select: { id: true },
    });
    return id;
  }
}
