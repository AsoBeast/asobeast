import type {
  PortfolioAppInsight,
  PortfolioInsights,
  PortfolioInsightTotals,
  PortfolioMovement,
  RankDistribution,
} from "@asobeast/shared";
import { MANY_PORTFOLIO_APPS } from "./fixtures.mts";

const NO_BANDS: RankDistribution = {
  top1: 0,
  top3: 0,
  top10: 0,
  top50: 0,
  beyond: 0,
  unranked: 0,
};

const STILL: PortfolioMovement = { up: 0, down: 0, entered: 0, lost: 0 };

const quiet = (appId: string): PortfolioAppInsight => ({
  appId,
  rankDistribution: NO_BANDS,
  top10Delta7d: null,
  movement: STILL,
  rating: { average: null, count: null, averageDelta7d: null },
  audit: null,
  actions: { open: 0, critical: 0, high: 0 },
  changes7d: { own: 0, competitors: 0 },
  negativeReviews7d: 0,
});

const APPS: PortfolioAppInsight[] = [
  {
    appId: "app-1",
    rankDistribution: {
      top1: 1,
      top3: 2,
      top10: 4,
      top50: 5,
      beyond: 0,
      unranked: 0,
    },
    top10Delta7d: 1,
    movement: { up: 3, down: 1, entered: 1, lost: 0 },
    rating: { average: 4.6, count: 1840, averageDelta7d: 0.1 },
    audit: { current: 72, delta7d: 4 },
    actions: { open: 5, critical: 1, high: 2 },
    changes7d: { own: 1, competitors: 1 },
    negativeReviews7d: 2,
  },
  {
    ...quiet("app-2"),
    rating: { average: 4.1, count: 212, averageDelta7d: null },
  },
  {
    ...quiet("app-1-de"),
    rankDistribution: {
      top1: 0,
      top3: 0,
      top10: 1,
      top50: 2,
      beyond: 0,
      unranked: 1,
    },
    top10Delta7d: -1,
    movement: { up: 0, down: 2, entered: 0, lost: 1 },
    rating: { average: 4.4, count: 96, averageDelta7d: -0.1 },
    audit: { current: 48, delta7d: -2 },
    actions: { open: 2, critical: 0, high: 0 },
  },
  {
    ...quiet("app-gp"),
    rankDistribution: {
      top1: 0,
      top3: 1,
      top10: 2,
      top50: 3,
      beyond: 0,
      unranked: 0,
    },
    top10Delta7d: 0,
    movement: { up: 1, down: 0, entered: 0, lost: 0 },
    audit: { current: 55, delta7d: null },
    actions: { open: 1, critical: 0, high: 1 },
  },
  quiet("app-pending"),
];

const sum = (
  apps: PortfolioAppInsight[],
  value: (app: PortfolioAppInsight) => number,
): number => apps.reduce((total, app) => total + value(app), 0);

const totalsOf = (apps: PortfolioAppInsight[]): PortfolioInsightTotals => {
  const deltas = apps.flatMap((app) =>
    app.top10Delta7d === null ? [] : [app.top10Delta7d],
  );
  return {
    top10: sum(apps, (app) => app.rankDistribution.top10),
    top10Delta7d:
      deltas.length === 0 ? null : deltas.reduce((a, b) => a + b, 0),
    movement: {
      up: sum(apps, (app) => app.movement.up),
      down: sum(apps, (app) => app.movement.down),
      entered: sum(apps, (app) => app.movement.entered),
      lost: sum(apps, (app) => app.movement.lost),
    },
    changes7d: {
      own: sum(apps, (app) => app.changes7d.own),
      competitors: sum(apps, (app) => app.changes7d.competitors),
    },
    negativeReviews7d: sum(apps, (app) => app.negativeReviews7d),
  };
};

export const LONG_MOVER_TEXT =
  "pomodoro focus timer with ambient sounds for deep work sessions";

export const PORTFOLIO_INSIGHTS: PortfolioInsights = {
  apps: APPS,
  movers: {
    up: [
      {
        appId: "app-1",
        country: "us",
        keywordId: "kw-1",
        text: "focus timer",
        from: 14,
        fromDepth: 200,
        to: 6,
        toDepth: 200,
      },
      {
        appId: "app-gp",
        country: "de",
        keywordId: "kw-gp-1",
        text: LONG_MOVER_TEXT,
        from: null,
        fromDepth: 200,
        to: 18,
        toDepth: 200,
      },
      {
        appId: "app-1",
        country: "us",
        keywordId: "kw-2",
        text: "pomodoro",
        from: 9,
        fromDepth: 200,
        to: 7,
        toDepth: 200,
      },
    ],
    down: [
      {
        appId: "app-1-de",
        country: "de",
        keywordId: "kw-de-1",
        text: "fokus timer",
        from: 8,
        fromDepth: 200,
        to: null,
        toDepth: 200,
      },
      {
        appId: "app-1",
        country: "us",
        keywordId: "kw-3",
        text: "study timer",
        from: 21,
        fromDepth: 200,
        to: 27,
        toDepth: 200,
      },
    ],
  },
  totals: totalsOf(APPS),
};

const stillWith = (
  change: (app: PortfolioAppInsight) => PortfolioAppInsight,
): PortfolioInsights => {
  const apps = APPS.map((app) => change({ ...app, movement: STILL }));
  return { apps, movers: { up: [], down: [] }, totals: totalsOf(apps) };
};

export const QUIET_PORTFOLIO_INSIGHTS = stillWith((app) => app);

export const UNRANKED_PORTFOLIO_INSIGHTS = stillWith((app) => ({
  ...app,
  rankDistribution: { ...NO_BANDS, unranked: 3 },
  top10Delta7d: 0,
}));

export const FRESH_PORTFOLIO_INSIGHTS = stillWith((app) => ({
  ...app,
  top10Delta7d: null,
}));

export const EMPTY_PORTFOLIO_INSIGHTS: PortfolioInsights = {
  apps: [],
  movers: { up: [], down: [] },
  totals: totalsOf([]),
};

export const MANY_PORTFOLIO_INSIGHTS: PortfolioInsights = {
  ...PORTFOLIO_INSIGHTS,
  apps: [
    ...APPS,
    ...MANY_PORTFOLIO_APPS.map((app, index) => ({
      ...quiet(app.id),
      rating: { average: 3.5 + index / 10, count: 40, averageDelta7d: null },
    })),
  ],
};
