import { Injectable } from '@nestjs/common';
import { ActionItem, ActionTrend, ActionTrendMetric } from '@asobeast/shared';
import {
  addDays,
  trackedRows,
  visibilityPoints,
} from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTION_TREND_RATING_DAYS,
  dailyPoints,
  trailingMeanPoints,
  TREND_DIRECTION,
  TREND_METRIC,
  TrendWindow,
  trendWindow,
  updateAgePoints,
} from './action-trend';
import { HOME_LISTING } from '../apps/listing';

interface SeriesBody {
  depth: number | null;
  points: ActionTrend['points'];
}

function trendKeywordId(item: ActionItem): string | null {
  return item.evidence?.rule === 'competitor.investigate_overtake'
    ? (item.evidence.keywords[0]?.keywordId ?? null)
    : item.scope.keywordId;
}

@Injectable()
export class ActionSeriesReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(item: ActionItem, today: Date): Promise<ActionTrend | null> {
    const metric = TREND_METRIC[item.rule];
    const window = trendWindow(
      new Date(item.firstSeenAt),
      item.closedAt ? new Date(item.closedAt) : null,
      today,
    );
    const body = await this.series(metric, item, window);
    if (!body) return null;
    return { metric, direction: TREND_DIRECTION[metric], ...body };
  }

  private series(
    metric: ActionTrendMetric,
    item: ActionItem,
    window: TrendWindow,
  ): Promise<SeriesBody | null> {
    switch (metric) {
      case 'position':
        return this.position(item, window);
      case 'visibility':
        return this.visibility(item, window);
      case 'audit':
        return this.audit(item, window);
      case 'rating':
        return this.rating(item, window);
      case 'updateAge':
        return this.updateAge(item, window);
    }
  }

  private async position(
    item: ActionItem,
    { from, to }: TrendWindow,
  ): Promise<SeriesBody | null> {
    const keywordId = trendKeywordId(item);
    if (keywordId === null) return null;
    const rows = await this.prisma.keywordRanking.findMany({
      where: { appId: item.scope.appId, keywordId, date: { gte: from } },
      orderBy: { date: 'asc' },
      select: { date: true, position: true, depth: true },
    });
    return {
      depth: rows.at(-1)?.depth ?? null,
      points: dailyPoints(
        rows.map((row) => ({ date: row.date, value: row.position })),
        from,
        to,
      ),
    };
  }

  private async visibility(
    item: ActionItem,
    { from, to }: TrendWindow,
  ): Promise<SeriesBody> {
    const rows = await trackedRows(this.prisma, item.scope.appId, from, to);
    const market = rows.filter(
      (row) => row.keyword.country === item.scope.country,
    );
    return {
      depth: null,
      points: dailyPoints(
        visibilityPoints(market).map((point) => ({
          date: new Date(point.date),
          value: point.visibility,
        })),
        from,
        to,
      ),
    };
  }

  private async audit(
    item: ActionItem,
    { from, to }: TrendWindow,
  ): Promise<SeriesBody> {
    const rows = await this.prisma.auditScore.findMany({
      where: {
        appId: item.scope.appId,
        date: { gte: from },
        overall: { not: null },
      },
      select: { date: true, overall: true },
    });
    return {
      depth: null,
      points: dailyPoints(
        rows.map((row) => ({ date: row.date, value: row.overall })),
        from,
        to,
      ),
    };
  }

  private async rating(
    item: ActionItem,
    { from, to }: TrendWindow,
  ): Promise<SeriesBody> {
    const rows = await this.prisma.review.findMany({
      where: {
        appId: item.scope.appId,
        reviewedAt: { gte: addDays(from, -ACTION_TREND_RATING_DAYS) },
      },
      select: { score: true, reviewedAt: true },
    });
    return {
      depth: null,
      points: trailingMeanPoints(
        rows.flatMap((row) =>
          row.reviewedAt ? [{ date: row.reviewedAt, score: row.score }] : [],
        ),
        from,
        to,
        ACTION_TREND_RATING_DAYS,
      ),
    };
  }

  private async updateAge(
    item: ActionItem,
    { from, to }: TrendWindow,
  ): Promise<SeriesBody> {
    const rows = await this.prisma.appSnapshot.findMany({
      where: {
        appId: item.scope.appId,
        ...HOME_LISTING,
        capturedAt: { gte: from },
      },
      select: { capturedAt: true, storeUpdatedAt: true },
    });
    return { depth: null, points: updateAgePoints(rows, from, to) };
  }
}
