import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppSummary,
  CoverageSummary,
  CURRENT_FORMULA_VERSIONS,
  QUERY_BOUNDS,
  RankDistributionHistory,
  RatingsHistory,
  UncoveredKeyword,
  visibility,
  VisibilityHistory,
  VisibilitySummary,
} from '@asobeast/shared';
import { coversKeyword } from '../keywords/keyword-coverage';
import {
  KeywordFieldIndex,
  loadKeywordFieldIndex,
  reportedSource,
} from '../keywords/keyword-field-index';
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
  keywordWindow,
  metricAt,
  referenceDate,
  startOfUtcDay,
  toDateKey,
  TrackedRow,
  trackedRows,
  utcToday,
  visibilityPoints,
} from './analytics.support';
import { MarketHistoryQueryDto } from './dto/market-history-query.dto';
import { VisibilityCompareQueryDto } from './dto/visibility-compare-query.dto';
import { VisibilityHistoryQueryDto } from './dto/visibility-history-query.dto';
import { movers } from './movers';
import { checkedPositionsNow, currentCheck, keywordsNow } from './baseline';
import { bucketPositions, rankDistributionNow } from './rank-distribution';
import { collapseRatings } from './ratings-history';
import { ShareOfVoiceService } from './share-of-voice.service';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';
import { countDiscoveries } from '../keyword-discovery/discovery-counts';
import { fitsOwnListing } from '../keywords/keyword-class';
import { ListingVerdicts } from '../keywords/keyword-classes';
import { KeywordsService } from '../keywords/keywords.service';

const SUMMARY_WINDOW_DAYS = 31;
const COVERAGE_LIMIT = 5;
const HISTORY_DEFAULT_DAYS = 30;
const HISTORY_MAX_DAYS = QUERY_BOUNDS.historyDays.max;
const SNAPSHOT_HISTORY_MAX_DAYS = QUERY_BOUNDS.snapshotHistoryDays.max;

interface CoverageApp {
  snapshotText: string;
  inKeywordField: KeywordFieldIndex;
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
    ? currentCheck(row.keyword.rankings, referenceDate)
    : null;
  return appOpportunity({
    source: reportedSource(
      row.source,
      app.inKeywordField(row.keyword.country, row.keyword.text),
    ),
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

const assertRange = (from: Date, to: Date, maxDays: number): void => {
  if (to.getTime() - from.getTime() > maxDays * DAY_MS) {
    throw new BadRequestException(`Range must not exceed ${maxDays} days`);
  }
};

interface CoverageListing extends ListingVerdicts {
  snapshot: {
    title: string;
    subtitle: string | null;
    description: string;
  } | null;
  inKeywordField: KeywordFieldIndex;
}

const uncoveredWorthAdding = (
  scored: AppOpportunity | null,
): scored is AppOpportunity & { opportunity: number } =>
  scored !== null &&
  scored.opportunity !== null &&
  scored.opportunity >= OPPORTUNITY_HIGH &&
  scored.relevance >= OPPORTUNITY_MIN_RELEVANCE;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shares: ShareOfVoiceService,
    private readonly keywords: KeywordsService,
  ) {}

  async summary(appId: string, country?: string): Promise<AppSummary> {
    await this.ensureApp(appId);

    const [
      market,
      everyMarket,
      snapshot,
      shareContext,
      inKeywordField,
      discoveries,
      verdicts,
    ] = await Promise.all([
      keywordWindow(this.prisma, { appId, country }, SUMMARY_WINDOW_DAYS),
      country
        ? keywordWindow(this.prisma, { appId }, SUMMARY_WINDOW_DAYS)
        : null,
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
      this.shares.context({ appId, country }),
      loadKeywordFieldIndex(this.prisma, appId),
      countDiscoveries(this.prisma, [appId], country),
      this.keywords.listingVerdicts(appId),
    ]);
    const covered = everyMarket ?? market;
    const share = await this.shares.summary(shareContext, market);

    return {
      visibility: this.visibilitySummary(market.rows, market.referenceDate),
      rankDistribution: rankDistributionNow(market.rows, market.referenceDate),
      movers: movers(market.rows, market.referenceDate),
      coverage: this.coverage(covered.rows, covered.referenceDate, {
        snapshot,
        inKeywordField,
        ...verdicts,
      }),
      lastRefreshAt: snapshot?.capturedAt.toISOString() ?? null,
      trackedKeywords: market.rows.length,
      competitors: shareContext.competitorIds.length,
      ...share,
      discoveries: discoveries.get(appId),
    };
  }

  async history(
    appId: string,
    query: VisibilityCompareQueryDto,
  ): Promise<VisibilityHistory> {
    await this.ensureApp(appId);

    const to = query.to ? startOfUtcDay(new Date(query.to)) : utcToday();
    const from = query.from
      ? startOfUtcDay(new Date(query.from))
      : addDays(to, -HISTORY_DEFAULT_DAYS);

    assertRange(
      from,
      to,
      query.compare === 'competitors'
        ? SNAPSHOT_HISTORY_MAX_DAYS
        : HISTORY_MAX_DAYS,
    );

    const [rows, reference] = await Promise.all([
      trackedRows(this.prisma, { appId, country: query.country }, from, to),
      referenceDate(this.prisma, { appId, country: query.country }),
    ]);
    const points = visibilityPoints(rows, reference);
    if (query.compare !== 'competitors') {
      return { points };
    }
    const shares = await this.shares.history(
      { appId, country: query.country },
      rows,
      { from, to },
    );
    return { points, ...shares };
  }

  async rankDistributionHistory(
    appId: string,
    query: MarketHistoryQueryDto,
  ): Promise<RankDistributionHistory> {
    await this.ensureApp(appId);

    const reference = await referenceDate(this.prisma, {
      appId,
      country: query.country,
    });
    const to = query.to
      ? startOfUtcDay(new Date(query.to))
      : (reference ?? utcToday());
    const from = query.from
      ? startOfUtcDay(new Date(query.from))
      : addDays(to, -HISTORY_DEFAULT_DAYS);

    assertRange(from, to, HISTORY_MAX_DAYS);

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

    const points = [...byDate.keys()]
      .sort((a, b) => a - b)
      .map((time) => ({
        date: toDateKey(new Date(time)),
        ...bucketPositions(
          time === reference?.getTime()
            ? checkedPositionsNow(rows, new Date(time))
            : (byDate.get(time) ?? []),
        ),
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

    assertRange(from, to, SNAPSHOT_HISTORY_MAX_DAYS);

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
    const current = visibility(keywordsNow(rows, referenceDate));
    return {
      current,
      delta7d: delta(rows, referenceDate, current, 7),
      delta30d: delta(rows, referenceDate, current, 30),
    };
  }

  private coverage(
    rows: TrackedRow[],
    referenceDate: Date | null,
    { snapshot, inKeywordField, classes, uncovered }: CoverageListing,
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
      inKeywordField,
    };

    const phraseCount = (field: string): number =>
      rows.filter((row) => coversKeyword(field, row.keyword.text)).length;

    const worthAdding = rows
      .filter(
        (row) =>
          uncovered.has(row.keywordId) &&
          fitsOwnListing(classes.get(row.keywordId)),
      )
      .flatMap((row): UncoveredKeyword[] => {
        const scored = rowOpportunity(row, referenceDate, app);
        return uncoveredWorthAdding(scored)
          ? [
              {
                keywordId: row.keywordId,
                text: row.keyword.text,
                opportunity: scored.opportunity,
              },
            ]
          : [];
      });

    return {
      inTitle: phraseCount(fields.title),
      inSubtitle: phraseCount(fields.subtitle),
      inDescription: phraseCount(fields.description),
      uncoveredHighOpportunity: worthAdding
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
