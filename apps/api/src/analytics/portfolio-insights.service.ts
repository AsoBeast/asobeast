import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OwnedChangeCounts,
  PortfolioAppInsight,
  PortfolioInsights,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  sparklineRows,
  startOfUtcDay,
  windowVisibility,
} from './analytics.support';
import {
  insightTotals,
  mergePortfolioMovers,
  RankInsight,
  rankInsight,
  RatingSample,
  ratingTrend,
} from './portfolio-insights';
import {
  EMPTY_ACTION_COUNTS,
  PortfolioSignals,
} from './portfolio-signals.service';
import { reviewsWrittenInWindow } from './review-window';

const INSIGHT_WINDOW_DAYS = 7;
const RATING_BASELINE_SEARCH_DAYS = 30;

interface InsightApp {
  id: string;
  name: string | null;
  competitors: { id: string }[];
  snapshots: RatingSample[];
}

type AppRank = RankInsight & { visibility: number };

@Injectable()
export class PortfolioInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signals: PortfolioSignals,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async insights(): Promise<PortfolioInsights> {
    const now = new Date();
    const since = addDays(now, -INSIGHT_WINDOW_DAYS);
    const today = startOfUtcDay(now);
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      select: {
        id: true,
        name: true,
        competitors: { select: { id: true } },
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { ratingAvg: true, ratingCount: true, capturedAt: true },
        },
      },
    });
    const appIds = apps.map((app) => app.id);

    const [ranks, actions, changes, negative, baselines, audits] =
      await Promise.all([
        Promise.all(appIds.map((id) => this.rankFor(id))),
        this.signals.actionCounts(appIds),
        this.changeCounts(apps, since),
        this.negativeReviewCounts(appIds, since),
        this.ratingBaselines(appIds, since),
        Promise.all(appIds.map((id) => this.signals.auditTrend(id, today))),
      ]);

    const ordered = apps
      .map((app, index) => ({ app, rank: ranks[index], audit: audits[index] }))
      .sort(
        (a, b) =>
          b.rank.visibility - a.rank.visibility ||
          (a.app.name ?? '').localeCompare(b.app.name ?? ''),
      );

    const insights = ordered.map(
      ({ app, rank, audit }): PortfolioAppInsight => ({
        appId: app.id,
        rankDistribution: rank.rankDistribution,
        top10Delta7d: rank.top10Delta7d,
        movement: rank.movement,
        rating: ratingTrend(
          app.snapshots[0] ?? null,
          baselines.get(app.id) ?? null,
        ),
        audit,
        actions:
          actions === null
            ? null
            : (actions.get(app.id) ?? EMPTY_ACTION_COUNTS),
        changes7d: changes.get(app.id) ?? { own: 0, competitors: 0 },
        negativeReviews7d: negative.get(app.id) ?? 0,
      }),
    );

    return {
      apps: insights,
      movers: mergePortfolioMovers(
        ordered.map(({ app, rank }) => ({
          appId: app.id,
          movers: rank.movers,
        })),
      ),
      totals: insightTotals(insights),
    };
  }

  private async rankFor(appId: string): Promise<AppRank> {
    const { rows, referenceDate } = await sparklineRows(this.prisma, appId);
    return {
      ...rankInsight(rows, referenceDate),
      visibility: windowVisibility(rows, referenceDate).current,
    };
  }

  private async changeCounts(
    apps: InsightApp[],
    since: Date,
  ): Promise<Map<string, OwnedChangeCounts>> {
    const primaryOf = new Map(
      apps.flatMap((app) =>
        app.competitors.map((competitor) => [competitor.id, app.id] as const),
      ),
    );
    const rows = await this.prisma.changeEvent.groupBy({
      by: ['appId'],
      where: {
        appId: { in: [...apps.map((app) => app.id), ...primaryOf.keys()] },
        capturedAt: { gte: since },
      },
      _count: { _all: true },
    });

    const counts = new Map<string, OwnedChangeCounts>();
    for (const row of rows) {
      const primaryId = primaryOf.get(row.appId) ?? row.appId;
      const current = counts.get(primaryId) ?? { own: 0, competitors: 0 };
      if (primaryOf.has(row.appId)) {
        current.competitors += row._count._all;
      } else {
        current.own += row._count._all;
      }
      counts.set(primaryId, current);
    }
    return counts;
  }

  private async negativeReviewCounts(
    appIds: string[],
    since: Date,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.review.groupBy({
      by: ['appId'],
      where: {
        appId: { in: appIds },
        score: {
          lte: this.config.get('ALERT_REVIEW_SCORE_MAX', { infer: true }),
        },
        ...reviewsWrittenInWindow(since),
      },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.appId, row._count._all]));
  }

  private async ratingBaselines(
    appIds: string[],
    since: Date,
  ): Promise<Map<string, RatingSample>> {
    const rows = await this.prisma.appSnapshot.findMany({
      where: {
        appId: { in: appIds },
        capturedAt: {
          lte: since,
          gte: addDays(since, -RATING_BASELINE_SEARCH_DAYS),
        },
      },
      distinct: ['appId'],
      orderBy: [{ appId: 'asc' }, { capturedAt: 'desc' }],
      select: {
        appId: true,
        ratingAvg: true,
        ratingCount: true,
        capturedAt: true,
      },
    });
    return new Map(rows.map(({ appId, ...sample }) => [appId, sample]));
  }
}
