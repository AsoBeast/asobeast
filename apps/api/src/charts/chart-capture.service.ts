import { Injectable } from '@nestjs/common';
import { CHART_DEPTH, ChartKey } from '@asobeast/shared';
import { Prisma } from '@prisma/client';
import { toDateKey, utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/unique-violation';
import { StoreRequestError } from '../store-providers/errors';
import { isImplausiblyEmpty } from '../store-providers/result-plausibility';
import { ChartListsNoAppsError } from './chart-lists-no-apps.error';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ChartItem } from '../store-providers/types';
import { chartCategoryKey } from './chart-category';

export interface ChartRowListing {
  position: number;
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
  entries: ChartRowListing[];
}

export interface CaptureOptions {
  spend?: () => Promise<void>;
  through?: <T>(work: () => Promise<T>) => Promise<T>;
  finalAttempt?: boolean;
}

const WITH_ENTRIES = {
  include: {
    entries: {
      orderBy: { position: 'asc' },
      omit: { captureId: true },
    },
  },
} satisfies Pick<Prisma.ChartCaptureFindFirstArgs, 'include'>;

function entriesOf(
  items: ChartItem[],
): Prisma.ChartEntryCreateWithoutCaptureInput[] {
  const seen = new Set<string>();
  return items.flatMap((item, index) => {
    if (seen.has(item.storeAppId)) return [];
    seen.add(item.storeAppId);
    return [{ ...item, position: index + 1 }];
  });
}

const SPARSE_CHART_ENTRIES = 10;

interface Progress {
  reachedStore: boolean;
}

interface Flight {
  capture: Promise<StoredChart>;
  progress: Progress;
}

const directly = <T>(work: () => Promise<T>): Promise<T> => work();

function flightOf(key: ChartKey, date: Date): string {
  return `${chartCategoryKey(key)}~${key.collection}~${toDateKey(date)}`;
}

@Injectable()
export class ChartCaptureService {
  private readonly inFlight = new Map<string, Flight>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  captureToday(
    key: ChartKey,
    options: CaptureOptions = {},
  ): Promise<StoredChart> {
    const date = utcToday();
    const name = flightOf(key, date);
    const running = this.inFlight.get(name);
    if (running) return this.join(running, key, options);

    const progress: Progress = { reachedStore: false };
    const capture = this.capture(key, date, options, progress).finally(() =>
      this.inFlight.delete(name),
    );
    this.inFlight.set(name, { capture, progress });
    return capture;
  }

  stored(key: ChartKey, date: Date): Promise<StoredChart | null> {
    return this.prisma.chartCapture.findUnique({
      where: { store_country_collection_genre_device_date: { ...key, date } },
      ...WITH_ENTRIES,
    });
  }

  newestOnOrBefore(
    key: ChartKey,
    date: Date,
    notBefore?: Date,
  ): Promise<StoredChart | null> {
    return this.prisma.chartCapture.findFirst({
      where: { ...key, date: { lte: date, gte: notBefore } },
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

  private async join(
    flight: Flight,
    key: ChartKey,
    options: CaptureOptions,
  ): Promise<StoredChart> {
    try {
      return await flight.capture;
    } catch (error) {
      if (flight.progress.reachedStore) throw error;
      return this.captureToday(key, options);
    }
  }

  private async capture(
    key: ChartKey,
    date: Date,
    { spend, through = directly, finalAttempt }: CaptureOptions,
    progress: Progress,
  ): Promise<StoredChart> {
    const stored = await this.stored(key, date);
    if (stored) return stored;
    await spend?.();

    const depth = CHART_DEPTH[key.store];
    progress.reachedStore = true;
    const items = await through(() =>
      this.registry
        .get(key.store)
        .topCharts(key.collection, key.genre, depth, key.country),
    );
    if (items.length === 0) await this.admitEmpty(key, date, finalAttempt);

    try {
      return await this.prisma.chartCapture.create({
        data: { ...key, date, depth, entries: { create: entriesOf(items) } },
        ...WITH_ENTRIES,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.stored(key, date);
      if (!winner) throw error;
      return winner;
    }
  }

  private async admitEmpty(
    key: ChartKey,
    date: Date,
    finalAttempt: boolean | undefined,
  ): Promise<void> {
    const [lastListed, latest] = await Promise.all([
      this.prisma.chartCapture.findFirst({
        where: { ...key, date: { lt: date }, entries: { some: {} } },
        orderBy: { date: 'desc' },
        select: { date: true, _count: { select: { entries: true } } },
      }),
      this.prisma.chartCapture.findFirst({
        where: { ...key, date: { lt: date } },
        orderBy: { date: 'desc' },
        select: { _count: { select: { entries: true } } },
      }),
    ]);
    if (
      lastListed &&
      lastListed._count.entries >= SPARSE_CHART_ENTRIES &&
      isImplausiblyEmpty({
        resultCount: 0,
        lastSeenOn: lastListed.date,
        today: date,
      })
    ) {
      throw new StoreRequestError(
        key.store,
        'topCharts',
        `the chart feed answered no entries although it listed apps on ${toDateKey(lastListed.date)}`,
      );
    }
    if (finalAttempt || latest?._count.entries === 0) return;
    throw finalAttempt === undefined
      ? new ChartListsNoAppsError(key)
      : new StoreRequestError(
          key.store,
          'topCharts',
          'the chart feed answered no entries',
        );
  }
}
