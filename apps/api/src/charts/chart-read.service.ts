import { Injectable } from '@nestjs/common';
import {
  CHART_TRENDING_LIMIT,
  ChartCaptureSummary,
  ChartCompareWindow,
  ChartEntryItem,
  ChartGenre,
  chartGenreName,
  chartGenresOf,
  ChartKey,
  ChartPage,
  compareDays,
  QUERY_BOUNDS,
  Store,
} from '@asobeast/shared';
import { addDays, toDateKey, utcToday } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { chartAppLinks } from './chart-apps';
import { ChartCaptureService, StoredChart } from './chart-capture.service';
import { ChartFollowsService } from './chart-follows.service';
import { assertChartKey, chartKeyFrom } from './chart-key';
import { movementOf, trendingOf } from './chart-movement';

export interface ChartPageQuery extends ChartKey {
  date?: string;
  compare: ChartCompareWindow;
  dates: number;
}

type ChartListingItem = Omit<ChartEntryItem, 'previous' | 'delta' | 'movement'>;

function listingsOf(store: Store, chart: StoredChart): ChartListingItem[] {
  return chart.entries.map((entry) => ({
    ...entry,
    genreName:
      entry.genreId === null ? null : chartGenreName(store, entry.genreId),
  }));
}

function summaryOf(chart: StoredChart | null): ChartCaptureSummary | null {
  return (
    chart && {
      date: toDateKey(chart.date),
      depth: chart.depth,
      capturedAt: chart.capturedAt.toISOString(),
    }
  );
}

@Injectable()
export class ChartReadService {
  constructor(
    private readonly captures: ChartCaptureService,
    private readonly follows: ChartFollowsService,
    private readonly prisma: PrismaService,
    private readonly egress: ProxyEgress,
  ) {}

  async captureToday(
    query: ChartKey,
    spend: () => Promise<void>,
  ): Promise<ChartPage> {
    const key = chartKeyFrom(query);
    assertChartKey(key);
    await this.egress.through(key.store, key.country, () =>
      this.captures.captureToday(key, spend),
    );
    return this.page({
      ...key,
      compare: '1d',
      dates: QUERY_BOUNDS.chartDates.default,
    });
  }

  async page(query: ChartPageQuery): Promise<ChartPage> {
    const key = chartKeyFrom(query);
    assertChartKey(key);
    const capture = query.date
      ? await this.captures.stored(key, new Date(query.date))
      : await this.captures.newestOnOrBefore(key, utcToday());
    const comparison =
      capture && (await this.comparisonOf(key, capture, query));
    const current = capture ? listingsOf(key.store, capture) : [];
    const previous = comparison && listingsOf(key.store, comparison);
    const storeAppIds = current.map((row) => row.storeAppId);
    const [dates, followed, apps] = await Promise.all([
      this.captures.capturedDates(key, query.dates),
      this.follows.of(key),
      this.workspaceApps(key.store, storeAppIds),
    ]);

    return {
      chart: {
        ...key,
        genreName: chartGenreName(key.store, key.genre) ?? key.genre,
      },
      capture: summaryOf(capture),
      comparison: summaryOf(comparison),
      compare: query.compare,
      entries: movementOf(current, previous),
      trending: trendingOf(current, previous, CHART_TRENDING_LIMIT),
      dates,
      followed,
      apps,
    };
  }

  genres(store: Store): readonly ChartGenre[] {
    return chartGenresOf(store);
  }

  private comparisonOf(
    key: ChartKey,
    capture: StoredChart,
    query: ChartPageQuery,
  ): Promise<StoredChart | null> {
    const window = compareDays(query.compare);
    return this.captures.newestOnOrBefore(
      key,
      addDays(capture.date, -window),
      addDays(capture.date, -2 * window),
    );
  }

  private async workspaceApps(store: Store, storeAppIds: string[]) {
    if (storeAppIds.length === 0) return [];
    const apps = await this.prisma.app.findMany({
      where: { store, storeAppId: { in: storeAppIds } },
      select: {
        id: true,
        storeAppId: true,
        name: true,
        isCompetitor: true,
        primaryAppId: true,
        primaryApp: { select: { name: true } },
      },
    });
    return chartAppLinks(apps, storeAppIds);
  }
}
