import {
  AppRatingTrend,
  PortfolioAppInsight,
  PortfolioInsights,
  PortfolioInsightTotals,
  PortfolioKeywordMover,
  PortfolioMovement,
  RankDistribution,
} from '@asobeast/shared';
import { addDays, capturedOn, TrackedRow } from './analytics.support';
import { RankedMover, RankedMovers, rankedMovers } from './movers';
import { rankDistributionAt } from './rank-distribution';

const PORTFOLIO_MOVER_LIMIT = 5;
const TOP10_WINDOW_DAYS = 7;

export interface RankInsight {
  rankDistribution: RankDistribution;
  top10Delta7d: number | null;
  movement: PortfolioMovement;
  movers: RankedMovers;
}

export interface RatingSample {
  ratingAvg: number | null;
  ratingCount: number | null;
  capturedAt: Date;
}

type TaggedMover = RankedMover & { appId: string };

export function rankInsight(
  rows: TrackedRow[],
  reference: Date | null,
): RankInsight {
  const rankDistribution = rankDistributionAt(rows, reference);
  const movers = rankedMovers(rows, reference);
  return {
    rankDistribution,
    top10Delta7d: top10Delta(rows, reference, rankDistribution.top10),
    movement: {
      up: movers.up.length,
      down: movers.down.length,
      entered: movers.up.filter((mover) => mover.from === null).length,
      lost: movers.down.filter((mover) => mover.to === null).length,
    },
    movers,
  };
}

function top10Delta(
  rows: TrackedRow[],
  reference: Date | null,
  current: number,
): number | null {
  if (!reference) return null;
  const past = addDays(reference, -TOP10_WINDOW_DAYS);
  if (!capturedOn(rows, past)) return null;
  return current - rankDistributionAt(rows, past).top10;
}

export function mergePortfolioMovers(
  perApp: Array<{ appId: string; movers: RankedMovers }>,
): PortfolioInsights['movers'] {
  const tagged = (pick: (movers: RankedMovers) => RankedMover[]) =>
    perApp.flatMap(({ appId, movers }) =>
      pick(movers).map((mover): TaggedMover => ({ ...mover, appId })),
    );
  return {
    up: topMovers(
      tagged((movers) => movers.up),
      (a, b) => b.change - a.change,
    ),
    down: topMovers(
      tagged((movers) => movers.down),
      (a, b) => a.change - b.change,
    ),
  };
}

const topMovers = (
  movers: TaggedMover[],
  byChange: (a: TaggedMover, b: TaggedMover) => number,
): PortfolioKeywordMover[] =>
  movers
    .sort((a, b) => byChange(a, b) || a.text.localeCompare(b.text))
    .slice(0, PORTFOLIO_MOVER_LIMIT)
    .map(toPortfolioMover);

const toPortfolioMover = (mover: TaggedMover): PortfolioKeywordMover => ({
  appId: mover.appId,
  country: mover.country,
  keywordId: mover.keywordId,
  text: mover.text,
  from: mover.from,
  fromDepth: mover.fromDepth,
  to: mover.to,
  toDepth: mover.toDepth,
});

export function ratingTrend(
  latest: RatingSample | null,
  baseline: RatingSample | null,
): AppRatingTrend {
  const average = latest?.ratingAvg ?? null;
  const past =
    latest && baseline && baseline.capturedAt < latest.capturedAt
      ? baseline.ratingAvg
      : null;
  return {
    average,
    count: latest?.ratingCount ?? null,
    averageDelta7d:
      average === null || past === null
        ? null
        : Math.round((average - past) * 100) / 100,
  };
}

export function insightTotals(
  apps: PortfolioAppInsight[],
): PortfolioInsightTotals {
  const sum = (value: (app: PortfolioAppInsight) => number) =>
    apps.reduce((total, app) => total + value(app), 0);
  const deltas = apps.flatMap((app) =>
    app.top10Delta7d === null ? [] : [app.top10Delta7d],
  );
  return {
    top10: sum((app) => app.rankDistribution.top10),
    top10Delta7d:
      deltas.length === 0
        ? null
        : deltas.reduce((total, delta) => total + delta, 0),
    movement: {
      up: sum((app) => app.movement.up),
      down: sum((app) => app.movement.down),
      entered: sum((app) => app.movement.entered),
      lost: sum((app) => app.movement.lost),
    },
    changes7d: {
      own: sum((app) => app.changes7d.own),
      competitors: sum((app) => app.changes7d.competitors),
    },
    negativeReviews7d: sum((app) => app.negativeReviews7d),
  };
}
