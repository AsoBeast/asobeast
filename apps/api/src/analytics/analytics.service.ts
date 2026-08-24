import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppSummary,
  CoverageSummary,
  normalizeText,
  RankDistribution,
  RankDistributionHistory,
  RatingsHistory,
  UncoveredKeyword,
  VisibilityHistory,
  VisibilitySummary,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeOpportunity,
  defaultRelevance,
  toDifficulty100,
  toVolume,
} from '../scoring/formulas';
import {
  addDays,
  DAY_MS,
  delta,
  metricAt,
  positionAt,
  referenceDate,
  startOfUtcDay,
  toDateKey,
  TrackedRow,
  trackedRows,
  utcToday,
  visibilityAt,
  visibilityPoints,
} from './analytics.support';
import { VisibilityHistoryQueryDto } from './dto/visibility-history-query.dto';
import { movers } from './movers';
import { bucketPositions } from './rank-distribution';
import { collapseRatings } from './ratings-history';

const SUMMARY_WINDOW_DAYS = 31;
const HIGH_OPPORTUNITY = 60;
const COVERAGE_LIMIT = 5;
const HISTORY_DEFAULT_DAYS = 30;
const HISTORY_MAX_DAYS = 180;

const covers = (field: string, keyword: string): boolean =>
  ` ${normalizeText(field)} `.includes(` ${keyword} `);

const rowOpportunity = (
  row: TrackedRow,
  referenceDate: Date | null,
  snapshotText: string,
): number | null => {
  const metric = referenceDate
    ? metricAt(row.keyword.metrics, referenceDate)
    : null;
  const traffic = metric?.traffic ?? null;
  const difficulty = metric?.difficulty ?? null;
  const relevance =
    row.relevance ??
    defaultRelevance(row.source, row.keyword.text, snapshotText);
  return computeOpportunity(
    traffic === null ? null : toVolume(traffic),
    difficulty === null ? null : toDifficulty100(difficulty),
    relevance,
  );
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(appId: string): Promise<AppSummary> {
    await this.ensureApp(appId);

    const reference = await referenceDate(this.prisma, appId);
    const windowStart = reference
      ? addDays(reference, -SUMMARY_WINDOW_DAYS)
      : null;

    const [rows, snapshot, competitors] = await Promise.all([
      trackedRows(this.prisma, appId, windowStart, reference),
      this.prisma.appSnapshot.findFirst({
        where: { appId },
        orderBy: { capturedAt: 'desc' },
        select: {
          title: true,
          subtitle: true,
          description: true,
          capturedAt: true,
        },
      }),
      this.prisma.app.count({ where: { primaryAppId: appId } }),
    ]);

    return {
      visibility: this.visibilitySummary(rows, reference),
      rankDistribution: this.rankDistribution(rows, reference),
      movers: movers(rows, reference),
      coverage: this.coverage(rows, reference, snapshot),
      lastRefreshAt: snapshot?.capturedAt.toISOString() ?? null,
      trackedKeywords: rows.length,
      competitors,
    };
  }

  async history(
    appId: string,
    query: VisibilityHistoryQueryDto,
  ): Promise<VisibilityHistory> {
    await this.ensureApp(appId);

    const to = query.to ? startOfUtcDay(new Date(query.to)) : utcToday();
    const from = query.from
      ? startOfUtcDay(new Date(query.from))
      : addDays(to, -HISTORY_DEFAULT_DAYS);

    if (to.getTime() - from.getTime() > HISTORY_MAX_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Range must not exceed ${HISTORY_MAX_DAYS} days`,
      );
    }

    const rows = await trackedRows(this.prisma, appId, from, to);
    return { points: visibilityPoints(rows) };
  }

  async rankDistributionHistory(
    appId: string,
    query: VisibilityHistoryQueryDto,
  ): Promise<RankDistributionHistory> {
    await this.ensureApp(appId);

    const reference = await referenceDate(this.prisma, appId);
    const to = query.to
      ? startOfUtcDay(new Date(query.to))
      : (reference ?? utcToday());
    const from = query.from
      ? startOfUtcDay(new Date(query.from))
      : addDays(to, -HISTORY_DEFAULT_DAYS);

    if (to.getTime() - from.getTime() > HISTORY_MAX_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Range must not exceed ${HISTORY_MAX_DAYS} days`,
      );
    }

    const rows = await trackedRows(this.prisma, appId, from, to);
    const byDate = new Map<number, Array<number | null>>();
    for (const row of rows) {
      for (const ranking of row.keyword.rankings) {
        const list = byDate.get(ranking.date.getTime()) ?? [];
        list.push(ranking.position);
        byDate.set(ranking.date.getTime(), list);
      }
    }

    const points = [...byDate.entries()]
      .sort(([a], [b]) => a - b)
      .map(([time, positions]) => ({
        date: toDateKey(new Date(time)),
        ...bucketPositions(positions),
      }));

    return { points };
  }

  async ratingsHistory(
    appId: string,
    query: VisibilityHistoryQueryDto,
  ): Promise<RatingsHistory> {
    await this.ensureApp(appId);

    const to = query.to ? startOfUtcDay(new Date(query.to)) : utcToday();
    const from = query.from
      ? startOfUtcDay(new Date(query.from))
      : addDays(to, -HISTORY_DEFAULT_DAYS);

    if (to.getTime() - from.getTime() > HISTORY_MAX_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Range must not exceed ${HISTORY_MAX_DAYS} days`,
      );
    }

    const rows = await this.prisma.appSnapshot.findMany({
      where: { appId, capturedAt: { gte: from, lt: addDays(to, 1) } },
      orderBy: { capturedAt: 'asc' },
      select: { ratingAvg: true, ratingCount: true, capturedAt: true },
    });

    return { points: collapseRatings(rows) };
  }

  private visibilitySummary(
    rows: TrackedRow[],
    referenceDate: Date | null,
  ): VisibilitySummary {
    if (!referenceDate) {
      return { current: 0, delta7d: null, delta30d: null };
    }
    const current = visibilityAt(rows, referenceDate);
    return {
      current,
      delta7d: delta(rows, referenceDate, current, 7),
      delta30d: delta(rows, referenceDate, current, 30),
    };
  }

  private rankDistribution(
    rows: TrackedRow[],
    referenceDate: Date | null,
  ): RankDistribution {
    const distribution: RankDistribution = {
      top1: 0,
      top3: 0,
      top10: 0,
      top50: 0,
      beyond: 0,
      unranked: 0,
    };
    for (const row of rows) {
      const position = referenceDate
        ? positionAt(row.keyword.rankings, referenceDate)
        : null;
      if (position === null) {
        distribution.unranked += 1;
        continue;
      }
      if (position <= 1) distribution.top1 += 1;
      if (position <= 3) distribution.top3 += 1;
      if (position <= 10) distribution.top10 += 1;
      if (position <= 50) distribution.top50 += 1;
      if (position > 50) distribution.beyond += 1;
    }
    return distribution;
  }

  private coverage(
    rows: TrackedRow[],
    referenceDate: Date | null,
    snapshot: {
      title: string;
      subtitle: string | null;
      description: string;
    } | null,
  ): CoverageSummary {
    const fields = {
      title: snapshot?.title ?? '',
      subtitle: snapshot?.subtitle ?? '',
      description: snapshot?.description ?? '',
    };
    const snapshotText = [
      fields.title,
      fields.subtitle,
      fields.description,
    ].join(' ');

    const hits = rows.map((row) => ({
      row,
      inTitle: covers(fields.title, row.keyword.text),
      inSubtitle: covers(fields.subtitle, row.keyword.text),
      inDescription: covers(fields.description, row.keyword.text),
    }));

    const uncovered = hits
      .filter((hit) => !hit.inTitle && !hit.inSubtitle && !hit.inDescription)
      .map((hit) => ({
        keywordId: hit.row.keywordId,
        text: hit.row.keyword.text,
        opportunity: rowOpportunity(hit.row, referenceDate, snapshotText),
      }))
      .filter(
        (entry): entry is UncoveredKeyword =>
          entry.opportunity !== null && entry.opportunity >= HIGH_OPPORTUNITY,
      );

    return {
      inTitle: hits.filter((hit) => hit.inTitle).length,
      inSubtitle: hits.filter((hit) => hit.inSubtitle).length,
      inDescription: hits.filter((hit) => hit.inDescription).length,
      uncoveredHighOpportunity: uncovered
        .sort((a, b) => b.opportunity - a.opportunity)
        .slice(0, COVERAGE_LIMIT),
    };
  }

  private async ensureApp(appId: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
  }
}
