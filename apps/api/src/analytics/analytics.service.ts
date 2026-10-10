import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppSummary,
  CoverageSummary,
  CURRENT_FORMULA_VERSIONS,
  RankDistributionHistory,
  RatingsHistory,
  UncoveredKeyword,
  VisibilityHistory,
  VisibilitySummary,
} from '@asobeast/shared';
import { coversKeyword } from '../keywords/keyword-coverage';
import { reportedSource } from '../keywords/keyword-field-membership';
import { PrismaService } from '../prisma/prisma.service';
import { AppOpportunity, appOpportunity } from '../scoring/keyword-opportunity';
import {
  OPPORTUNITY_HIGH,
  OPPORTUNITY_MIN_RELEVANCE,
} from '../scoring/opportunity';
import {
  addDays,
  DAY_MS,
  delta,
  metricAt,
  rankingAt,
  referenceDate,
  startOfUtcDay,
  toDateKey,
  TrackedRow,
  trackedRows,
  utcToday,
  visibilityAt,
  visibilityPoints,
} from './analytics.support';
import { MarketHistoryQueryDto } from './dto/market-history-query.dto';
import { VisibilityHistoryQueryDto } from './dto/visibility-history-query.dto';
import { movers } from './movers';
import { bucketPositions, rankDistributionAt } from './rank-distribution';
import { collapseRatings } from './ratings-history';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';

const SUMMARY_WINDOW_DAYS = 31;
const COVERAGE_LIMIT = 5;
const HISTORY_DEFAULT_DAYS = 30;
const HISTORY_MAX_DAYS = 180;

interface CoverageApp {
  snapshotText: string;
}

const CURRENT_VERSIONS = new Set<string>(
  Object.values(CURRENT_FORMULA_VERSIONS),
);

const isCurrentFormula = (version?: string | null): boolean =>
  version === undefined || (version !== null && CURRENT_VERSIONS.has(version));

const rowOpportunity = (
  row: TrackedRow,
  referenceDate: Date | null,
  app: CoverageApp,
): AppOpportunity | null => {
  const metric = referenceDate
    ? metricAt(row.keyword.metrics, referenceDate)
    : null;
  if (metric && !isCurrentFormula(metric.formulaVersion)) {
    return null;
  }
  const ranking = referenceDate
    ? rankingAt(row.keyword.rankings, referenceDate)
    : null;
  return appOpportunity({
    source: reportedSource(row),
    keywordText: row.keyword.text,
    snapshotText: app.snapshotText,
    relevanceOverride: row.relevance,
    traffic: metric?.traffic ?? null,
    difficulty: metric?.difficulty ?? null,
    ...(ranking
      ? { ranking: { position: ranking.position, checked: true } }
      : {}),
  });
};

const uncoveredWorthAdding = (
  scored: AppOpportunity | null,
): scored is AppOpportunity & { opportunity: number } =>
  scored !== null &&
  scored.opportunity !== null &&
  scored.opportunity >= OPPORTUNITY_HIGH &&
  scored.relevance >= OPPORTUNITY_MIN_RELEVANCE;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(appId: string, country?: string): Promise<AppSummary> {
    await this.ensureApp(appId);

    const reference = await referenceDate(this.prisma, appId, country);
    const windowStart = reference
      ? addDays(reference, -SUMMARY_WINDOW_DAYS)
      : null;

    const [rows, snapshot, competitors] = await Promise.all([
      trackedRows(this.prisma, { appId, country }, windowStart, reference),
      this.prisma.appSnapshot.findFirst({
        where: { appId, ...HOME_LISTING },
        orderBy: NEWEST_FIRST,
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
      rankDistribution: rankDistributionAt(rows, reference),
      movers: movers(rows, reference),
      coverage: this.coverage(rows, reference, snapshot),
      lastRefreshAt: snapshot?.capturedAt.toISOString() ?? null,
      trackedKeywords: rows.length,
      competitors,
    };
  }

  async history(
    appId: string,
    query: MarketHistoryQueryDto,
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

    const rows = await trackedRows(
      this.prisma,
      { appId, country: query.country },
      from,
      to,
    );
    return { points: visibilityPoints(rows) };
  }

  async rankDistributionHistory(
    appId: string,
    query: MarketHistoryQueryDto,
  ): Promise<RankDistributionHistory> {
    await this.ensureApp(appId);

    const reference = await referenceDate(this.prisma, appId, query.country);
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

    const rows = await trackedRows(
      this.prisma,
      { appId, country: query.country },
      from,
      to,
    );
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
      where: {
        appId,
        ...HOME_LISTING,
        capturedAt: { gte: from, lt: addDays(to, 1) },
      },
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
    const app: CoverageApp = {
      snapshotText: [fields.title, fields.subtitle, fields.description].join(
        ' ',
      ),
    };

    const hits = rows.map((row) => ({
      row,
      inTitle: coversKeyword(fields.title, row.keyword.text),
      inSubtitle: coversKeyword(fields.subtitle, row.keyword.text),
      inDescription: coversKeyword(fields.description, row.keyword.text),
    }));

    const uncovered = hits
      .filter((hit) => !hit.inTitle && !hit.inSubtitle && !hit.inDescription)
      .flatMap((hit): UncoveredKeyword[] => {
        const scored = rowOpportunity(hit.row, referenceDate, app);
        return uncoveredWorthAdding(scored)
          ? [
              {
                keywordId: hit.row.keywordId,
                text: hit.row.keyword.text,
                opportunity: scored.opportunity,
              },
            ]
          : [];
      });

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
