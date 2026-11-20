import {
  STORES,
  type PortfolioApp,
  type PortfolioAppHistory,
  type PortfolioAppInsight,
  type PortfolioHistory,
  type PortfolioHistoryDays,
  type PortfolioHistoryScope,
  type PortfolioInsights,
  type PortfolioListingChange,
  type PortfolioMovement,
  type PortfolioPartChange,
  type PortfolioRangeChange,
  type RankDistributionPoint,
} from "@asobeast/shared";
import {
  portfolioHistoryOf,
  portfolioRangeDeltasOf,
  utcDaysAgo,
} from "./fixtures.mts";
import { rangeChangeOf } from "./portfolio-insights.mts";

const NO_MOVEMENT: PortfolioMovement = { up: 0, down: 0, entered: 0, lost: 0 };

const LAST_RUN_UP = 2;
const LAST_RUN_DOWN = 1;
const KEYWORDS_BEYOND_TOP_TEN = 4;

const LISTING_CHANGES: Array<{
  daysAgo: number;
  appId: string;
  fields: PortfolioListingChange["fields"];
}> = [
  { daysAgo: 5, appId: "app-1", fields: ["title"] },
  { daysAgo: 12, appId: "app-gp", fields: ["summary", "screenshots"] },
];

const spanOf = (app: PortfolioApp, days: PortfolioHistoryDays): number =>
  Math.round((app.visibility.delta7d ?? 0) * Math.sqrt(days / 7) * 10) / 10;

function partOf(
  app: PortfolioApp,
  insight: PortfolioAppInsight | undefined,
  days: PortfolioHistoryDays,
): PortfolioPartChange {
  return {
    visibility: app.visibility.current,
    visibilityDelta: app.visibility.delta7d === null ? null : spanOf(app, days),
    top10: insight?.rankDistribution.top10 ?? 0,
    top10Delta: insight?.top10Delta7d ?? null,
    movement: insight?.movement ?? NO_MOVEMENT,
  };
}

function lastRunOf(insights: PortfolioInsights): PortfolioRangeChange {
  const up = insights.movers.up.slice(0, LAST_RUN_UP);
  const down = insights.movers.down.slice(0, LAST_RUN_DOWN);
  return {
    compared: insights.totals.top10Delta7d !== null,
    visibilityDelta: 0.4,
    top10Delta: 0,
    movement: { up: up.length, down: down.length, entered: 0, lost: 0 },
    appsMoved: new Set([...up, ...down].map((mover) => mover.appId)).size,
    movers: { up, down },
  };
}

function appHistoryOf({
  app,
  insight,
  days,
  lastRun,
  busiest,
}: {
  app: PortfolioApp;
  insight: PortfolioAppInsight | undefined;
  days: PortfolioHistoryDays;
  lastRun: PortfolioRangeChange;
  busiest: boolean;
}): PortfolioAppHistory {
  const change = partOf(app, insight, days);
  const { points } = portfolioHistoryOf(days, {
    visibility: change.visibility,
    top10: change.top10,
    span: spanOf(app, days),
  });
  const movedIn = (movers: PortfolioRangeChange["movers"]["up"]) =>
    movers.filter((mover) => mover.appId === app.id).length;
  return {
    appId: app.id,
    points: (app.visibility.delta7d === null ? points.slice(-1) : points).map(
      (point) => (busiest ? point : { ...point, climbed: 0, fell: 0 }),
    ),
    change,
    lastRun: {
      ...NO_MOVEMENT,
      up: movedIn(lastRun.movers.up),
      down: movedIn(lastRun.movers.down),
    },
  };
}

function pooledPart(parts: PortfolioPartChange[]): PortfolioPartChange {
  const sum = (pick: (part: PortfolioPartChange) => number | null) =>
    parts.reduce((total, part) => total + (pick(part) ?? 0), 0);
  return {
    visibility:
      Math.round((sum((part) => part.visibility) / parts.length) * 10) / 10,
    visibilityDelta:
      Math.round((sum((part) => part.visibilityDelta) / parts.length) * 10) /
      10,
    top10: sum((part) => part.top10),
    top10Delta: sum((part) => part.top10Delta),
    movement: {
      up: sum((part) => part.movement.up),
      down: sum((part) => part.movement.down),
      entered: sum((part) => part.movement.entered),
      lost: sum((part) => part.movement.lost),
    },
  };
}

const bandsOf = (points: PortfolioHistory["points"]): RankDistributionPoint[] =>
  points.map(({ date, top10 }) => {
    const rank1 = Math.floor(top10 / 4);
    const rank2to3 = Math.floor(top10 / 3);
    return {
      date,
      rank1,
      rank2to3,
      rank4to10: top10 - rank1 - rank2to3,
      rank11to50: 2,
      rank51plus: 1,
      unranked: KEYWORDS_BEYOND_TOP_TEN - 3,
    };
  });

export function portfolioHistoryFor(
  days: PortfolioHistoryDays,
  listed: readonly PortfolioApp[],
  insights: PortfolioInsights,
  scope: PortfolioHistoryScope,
): PortfolioHistory {
  const charted = listed.filter(
    (app) =>
      app.lastCapturedAt !== null &&
      (scope.appId === undefined || app.id === scope.appId) &&
      (scope.store === undefined || app.store === scope.store),
  );
  const insightOf = (app: PortfolioApp) =>
    insights.apps.find((insight) => insight.appId === app.id);
  const change = rangeChangeOf(insights, portfolioRangeDeltasOf(days));
  if (charted.length === 0) {
    return { days, points: [], previous: [], change };
  }

  const lastRun = lastRunOf(insights);
  const apps = charted.map((app, index) =>
    appHistoryOf({
      app,
      insight: insightOf(app),
      days,
      lastRun,
      busiest: index === 0,
    }),
  );
  const whole = scope.appId === undefined && scope.store === undefined;
  const pooled = whole
    ? portfolioHistoryOf(days)
    : portfolioHistoryOf(days, {
        visibility: pooledPart(apps.map((each) => each.change)).visibility,
        top10: pooledPart(apps.map((each) => each.change)).top10,
        span: spanOf(charted[0], days),
      });
  const first = pooled.points[0].date;
  const ids = new Set(charted.map((app) => app.id));

  return {
    ...pooled,
    change,
    bands: bandsOf(pooled.points),
    apps,
    stores: STORES.flatMap((store) => {
      const members = apps.filter((_, index) => charted[index].store === store);
      return members.length === 0
        ? []
        : [
            {
              store,
              apps: members.length,
              change: pooledPart(members.map((each) => each.change)),
            },
          ];
    }),
    lastRun,
    listingChanges: LISTING_CHANGES.map(({ daysAgo, appId, fields }) => ({
      date: utcDaysAgo(daysAgo),
      appId,
      fields,
    })).filter((each) => ids.has(each.appId) && each.date >= first),
  };
}
