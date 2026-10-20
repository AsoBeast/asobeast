import type {
  ActionItem,
  ActionSummary,
  AlertDeliveryItem,
  ApiErrorEnvelope,
  AppDetail,
  AppScreenshots,
  AppStoreLocalization,
  AppListItem,
  AppSummary,
  CategoryCollection,
  CategoryRankSeries,
  ChartEntryItem,
  ChartMover,
  ChartPage,
  CategoryRankSeriesItem,
  CompetitorDiscovery,
  DailyBudget,
  EmailAlertItem,
  FirstRunStatus,
  AppRunStatus,
  KeywordComparison,
  KeywordCountrySummary,
  KeywordSource,
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  MarketKeywordFields,
  MarketSuggestion,
  MarketSuggestionsResult,
  ChangeImpactReport,
  ChangeImpactWindow,
  ChangeImpactWindowDays,
  ChangeTimeline,
  CompetitorItem,
  HealthStatus,
  StoreHealthReport,
  StoreSearchResult,
  CompetitorSuggestion,
  SimilarLookupState,
  WorkspaceRunStatus,
  PortfolioSummary,
  RankDistributionHistory,
  RankingPoint,
  RankingSeries,
  RatingsHistogram,
  ReviewThemes,
  RatingsHistory,
  ReviewItem,
  ReviewList,
  SerpMovers,
  SerpSnapshot,
  AppAuditResult,
  AuditRecommendation,
  AuditTarget,
  KeywordCoverageRow,
  LintIssue,
  ListingMarket,
  MetadataAuditResult,
  MetadataDraft,
  TrackedKeywordItem,
  VisibilityHistory,
  WebhookItem,
} from "@asobeast/shared";
import { summarizeActions } from "./actions-summary.mts";
import {
  FIRST_RUN_HISTORY_DAYS,
  FIRST_RUN_STAGES,
  APP_RUN_STAGES,
  OVERALL_GENRE,
  PLAN_LIMITS,
  RANK_DEPTH,
} from "@asobeast/shared";

export function utcDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function utcTimestampDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function pointsFrom(
  positions: Array<number | null>,
  depths?: number[],
): RankingPoint[] {
  return positions.map((position, index) => ({
    date: utcDaysAgo(positions.length - 1 - index),
    position,
    depth: depths?.[index] ?? RANK_DEPTH,
  }));
}

export const OPERATOR_TOKEN = "asob_operator";

export const VALID_UNSUBSCRIBE_TOKEN = "valid-token-".padEnd(43, "x");

export const VALID_CONFIRM_TOKEN = "confirm-token-".padEnd(43, "x");

export const EXPIRED_CONFIRM_TOKEN = "expired-token-".padEnd(43, "x");

export const TRUSTED_RECIPIENT = "owner@example.com";

export const UNSENT_RECIPIENT_PREFIX = "unsent-";

export const UNSUBSCRIBED_RECIPIENT = "left@example.net";

export const METRICS_SCRAPE =
  'asobeast_store_canary{store="APP_STORE",outcome="ok"} 1\n';

export const HEALTH: HealthStatus = {
  status: "ok",
  db: "up",
  redis: "up",
  pipeline: {
    lastDailyRunAt: new Date().toISOString(),
    stale: false,
    failedJobs: 0,
    actions: { generatedAt: new Date().toISOString(), open: 0 },
  },
};

export const HEALTH_DEGRADED: HealthStatus = {
  status: "ok",
  db: "up",
  redis: "up",
  pipeline: {
    lastDailyRunAt: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
    stale: true,
    failedJobs: 3,
    actions: { generatedAt: null, open: 0 },
  },
};

export const RUN_STATUS: WorkspaceRunStatus = {
  state: "complete",
  startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  lastCaptureAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  tracked: 4,
  captured: 4,
  stores: [{ store: "APP_STORE", tracked: 4, captured: 4 }],
};

export const FIRST_RUN_MID: FirstRunStatus = {
  appId: "app-new",
  complete: false,
  stages: [
    { stage: "metadata", ready: 1, total: 1, complete: true, expectedBy: null },
    { stage: "keywords", ready: 8, total: 8, complete: true, expectedBy: null },
    {
      stage: "rankings",
      ready: 3,
      total: 8,
      complete: false,
      expectedBy: utcTimestampDaysAgo(-1),
    },
    {
      stage: "scores",
      ready: 1,
      total: 8,
      complete: false,
      expectedBy: utcTimestampDaysAgo(-5),
    },
    { stage: "reviews", ready: 1, total: 1, complete: true, expectedBy: null },
    {
      stage: "history",
      ready: 1,
      total: FIRST_RUN_HISTORY_DAYS,
      complete: false,
      expectedBy: utcTimestampDaysAgo(-6),
    },
  ],
};

export const FIRST_RUN_UNSCHEDULED: FirstRunStatus = {
  appId: "app-2",
  complete: false,
  stages: [
    { stage: "metadata", ready: 1, total: 1, complete: true, expectedBy: null },
    { stage: "keywords", ready: 4, total: 4, complete: true, expectedBy: null },
    {
      stage: "rankings",
      ready: 0,
      total: 4,
      complete: false,
      expectedBy: null,
    },
    { stage: "scores", ready: 4, total: 4, complete: true, expectedBy: null },
    { stage: "reviews", ready: 0, total: 0, complete: true, expectedBy: null },
    {
      stage: "history",
      ready: FIRST_RUN_HISTORY_DAYS,
      total: FIRST_RUN_HISTORY_DAYS,
      complete: true,
      expectedBy: null,
    },
  ],
};

export const FIRST_RUN_COMPLETE: FirstRunStatus = {
  appId: "app-1",
  complete: true,
  stages: FIRST_RUN_STAGES.map((stage) => ({
    stage,
    ready: 1,
    total: 1,
    complete: true,
    expectedBy: null,
  })),
};

const appRun = (
  appId: string,
  state: AppRunStatus["state"],
  counts: readonly (readonly [number, number])[],
): AppRunStatus => ({
  appId,
  date: "2026-10-15",
  state,
  startedAt: "2026-10-15T03:00:00.000Z",
  lastCaptureAt: state === "idle" ? null : "2026-10-15T03:20:00.000Z",
  stages: APP_RUN_STAGES.map((stage, index) => ({
    stage,
    ready: counts[index][0],
    total: counts[index][1],
    complete: counts[index][0] >= counts[index][1],
  })),
});

export const APP_RUN_RUNNING = appRun("app-new", "running", [
  [2, 3],
  [3, 8],
  [1, 1],
]);

export const APP_RUN_COMPLETE = appRun("app-1", "complete", [
  [3, 3],
  [8, 8],
  [1, 1],
]);

export const APP_RUN_IDLE = appRun("app-2", "idle", [
  [0, 0],
  [0, 0],
  [0, 0],
]);

export const APP_RUN_DELAYED = appRun("app-new", "delayed", [
  [3, 3],
  [5, 8],
  [1, 1],
]);

export const APP_RUN_PAUSED: AppRunStatus = {
  ...APP_RUN_RUNNING,
  paused: true,
};

export const RUN_STATUS_DELAYED: WorkspaceRunStatus = {
  state: "delayed",
  startedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
  lastCaptureAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  tracked: 100,
  captured: 50,
  stores: [
    { store: "APP_STORE", tracked: 50, captured: 50 },
    { store: "GOOGLE_PLAY", tracked: 50, captured: 0 },
  ],
};

export const STORE_HEALTH_OK: StoreHealthReport = {
  stores: [
    {
      store: "APP_STORE",
      state: "ok",
      source: "canary",
      since: null,
      checkedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      detail: null,
    },
    {
      store: "GOOGLE_PLAY",
      state: "ok",
      source: "canary",
      since: null,
      checkedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      detail: null,
    },
  ],
  degraded: false,
};

export const STORE_HEALTH_BROKEN: StoreHealthReport = {
  stores: [
    {
      store: "APP_STORE",
      state: "broken",
      source: "canary",
      since: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      checkedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      detail: "parsed app is missing title",
    },
    STORE_HEALTH_OK.stores[1],
  ],
  degraded: true,
};

export const APP_1_KEYWORDS: TrackedKeywordItem[] = [
  {
    keywordId: "kw-1",
    text: "focus timer",
    tags: ["core", "testing", "students", "exam season", "brand"],
    country: "us",
    serpVolatility7d: 8,
    source: "TITLE",
    active: true,
    latestPosition: 3,
    latestDepth: RANK_DEPTH,
    previousPosition: 5,
    positionDelta1d: -2,
    positionDelta7d: -7,
    traffic: 55,
    difficulty: 4,
    volume: 5000,
    relevance: 90,
    opportunity: 82,
    bucket: "primary",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: {
      source: "APPLE_SEARCH_SIGNALS",
      formulaVersion: "app-store-v2",
      confidence: "HIGH",
      capturedAt: utcTimestampDaysAgo(0),
    },
    scoreSignals: {
      suggestReach: "hit",
      suggestPrefixLength: 2,
      suggestPosition: 8,
      serpRelevance: 0.9,
      medianRatingCount: 45000,
      flags: [],
      officialPopularity: null,
      estimatedTraffic: 5.5,
    },
    scoreOutdated: false,
  },
  {
    keywordId: "kw-2",
    text: "pomodoro",
    tags: ["core", "brand"],
    country: "us",
    serpVolatility7d: 72,
    source: "SUBTITLE",
    active: true,
    latestPosition: 12,
    latestDepth: RANK_DEPTH,
    previousPosition: 9,
    positionDelta1d: 3,
    positionDelta7d: 6,
    traffic: 70,
    difficulty: 7,
    volume: 9000,
    relevance: 60,
    opportunity: 60,
    bucket: "secondary",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: {
      source: "GOOGLE_PLAY_SUGGEST_REACH",
      formulaVersion: "google-play-v2",
      confidence: "MEDIUM",
      capturedAt: utcTimestampDaysAgo(1),
    },
    scoreSignals: {
      suggestReach: "listed",
      suggestPrefixLength: null,
      suggestPosition: 3,
      serpRelevance: 0.1,
      medianRatingCount: 800,
      flags: ["brand", "padded"],
      officialPopularity: null,
      estimatedTraffic: 7,
    },
    scoreOutdated: false,
  },
  {
    keywordId: "kw-3",
    text: "study timer",
    country: "us",
    serpVolatility7d: 35,
    source: "DESCRIPTION",
    active: true,
    latestPosition: 7,
    latestDepth: RANK_DEPTH,
    previousPosition: 7,
    positionDelta1d: 0,
    positionDelta7d: 0,
    traffic: 40,
    difficulty: 5,
    volume: 3000,
    relevance: 55,
    opportunity: 45,
    bucket: "longtail",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: {
      source: "APPLE_SUGGEST_SEARCH",
      formulaVersion: "app-store-v1",
      confidence: "LOW",
      capturedAt: "invalid",
    },
    scoreSignals: null,
    scoreOutdated: true,
  },
  {
    keywordId: "kw-4",
    text: "productivity app",
    country: "us",
    serpVolatility7d: null,
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: RANK_DEPTH,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: 65,
    difficulty: 6,
    volume: 8000,
    relevance: 80,
    opportunity: 70,
    bucket: "aspirational",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: null,
    scoreSignals: null,
    scoreOutdated: true,
  },
  {
    keywordId: "kw-5",
    text: "time blocking",
    tags: ["testing"],
    note: "Seasonal <push> in May\nKeep for exam season",
    country: "us",
    serpVolatility7d: 50,
    source: "COMPETITOR",
    active: false,
    latestPosition: 45,
    latestDepth: RANK_DEPTH,
    previousPosition: 44,
    positionDelta1d: 1,
    positionDelta7d: 5,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: 30,
    opportunity: null,
    bucket: "longtail",
    scoredAt: null,
    scoreProvenance: null,
  },
];

export const APP_1_RANKINGS: RankingSeries = {
  series: [
    {
      keywordId: "kw-1",
      text: "focus timer",
      store: "APP_STORE" as const,
      country: "us",
      points: pointsFrom([10, 9, 8, 7, 6, 5, 5, 3]),
    },
    {
      keywordId: "kw-2",
      text: "pomodoro",
      store: "APP_STORE" as const,
      country: "us",
      points: pointsFrom([6, 7, 8, 8, 9, 9, 9, 12]),
    },
    {
      keywordId: "kw-3",
      text: "study timer",
      store: "APP_STORE" as const,
      country: "us",
      points: pointsFrom([7, 7, 7, 7, 7, 7, 7, 7]),
    },
    {
      keywordId: "kw-4",
      text: "productivity app",
      store: "APP_STORE" as const,
      country: "us",
      points: pointsFrom(
        [null, null, null, null, null, null, null, null],
        [100, 100, 100, 100, 200, 200, 200, 200],
      ),
    },
    {
      keywordId: "kw-5",
      text: "time blocking",
      store: "APP_STORE" as const,
      country: "us",
      points: pointsFrom([40, 42, 44, 45, 45, 46, 46, 45]),
    },
  ],
};

export const APP_1_SERP_MOVERS: SerpMovers = {
  windowDays: 7,
  items: [
    {
      date: utcDaysAgo(1),
      keywordId: "kw-1",
      text: "focus timer",
      position: 4,
      storeAppId: "comp-store",
      title: "Rival Focus",
      appId: "comp-1",
      isCompetitor: true,
    },
    {
      date: utcDaysAgo(1),
      keywordId: "kw-2",
      text: "pomodoro",
      position: 7,
      storeAppId: "stranger-store",
      title: "Newcomer Timer",
      appId: null,
      isCompetitor: false,
    },
    {
      date: utcDaysAgo(3),
      keywordId: "kw-3",
      text: "study timer",
      position: 9,
      storeAppId: "late-store",
      title: "Late Bloomer",
      appId: null,
      isCompetitor: false,
    },
  ],
};

export const SERP_SNAPSHOTS: Record<string, SerpSnapshot> = {
  "kw-1": {
    keywordId: "kw-1",
    text: "focus timer",
    date: utcDaysAgo(0),
    entries: [
      {
        position: 1,
        storeAppId: "555000111",
        title: "Deep Work Sessions",
        developer: "Nordlys Labs",
        ratingAvg: 4.7,
        ratingCount: 8400,
        appId: null,
        isCompetitor: false,
      },
      {
        position: 2,
        storeAppId: "555000222",
        title: "Tomato Clock",
        developer: "Bitwise Studio",
        ratingAvg: 4.1,
        ratingCount: 1900,
        appId: null,
        isCompetitor: false,
      },
      {
        position: 3,
        storeAppId: "123456789",
        title: "Focus Timer",
        developer: "Focus Labs",
        ratingAvg: 4.8,
        ratingCount: 24000,
        appId: "app-1",
        isCompetitor: false,
      },
      {
        position: 4,
        storeAppId: "comp-store",
        title: "Rival Focus",
        developer: "Rival Labs",
        ratingAvg: 4.5,
        ratingCount: 12000,
        appId: "comp-1",
        isCompetitor: true,
      },
      {
        position: 5,
        storeAppId: "stranger-store",
        title: "Newcomer Timer",
        developer: null,
        ratingAvg: null,
        ratingCount: null,
        appId: null,
        isCompetitor: false,
      },
    ],
  },
};

export const APP_1_SUMMARY: AppSummary = {
  visibility: { current: 62.4, delta7d: 5, delta30d: -3 },
  rankDistribution: {
    top1: 1,
    top3: 2,
    top10: 3,
    top50: 4,
    beyond: 0,
    unranked: 1,
  },
  movers: {
    up: [
      {
        keywordId: "kw-1",
        text: "focus timer",
        from: 10,
        fromDepth: RANK_DEPTH,
        to: 3,
        toDepth: RANK_DEPTH,
      },
    ],
    down: [
      {
        keywordId: "kw-2",
        text: "pomodoro",
        from: 6,
        fromDepth: RANK_DEPTH,
        to: 12,
        toDepth: RANK_DEPTH,
      },
    ],
  },
  coverage: {
    inTitle: 2,
    inSubtitle: 1,
    inDescription: 3,
    uncoveredHighOpportunity: [
      { keywordId: "kw-4", text: "productivity app", opportunity: 70 },
    ],
  },
  lastRefreshAt: utcTimestampDaysAgo(0),
  trackedKeywords: 5,
  competitors: 1,
};

export const APP_1_MARKET_SUMMARIES: Record<string, AppSummary> = {
  us: {
    ...APP_1_SUMMARY,
    visibility: { current: 71.2, delta7d: 4, delta30d: -1 },
    trackedKeywords: 3,
  },
  pl: {
    ...APP_1_SUMMARY,
    visibility: { current: 18.6, delta7d: -2, delta30d: null },
    rankDistribution: {
      top1: 0,
      top3: 0,
      top10: 1,
      top50: 2,
      beyond: 0,
      unranked: 0,
    },
    movers: { up: [], down: [] },
    trackedKeywords: 2,
  },
};

export const APP_1_VISIBILITY: VisibilityHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    visibility: 50 + (index % 12),
  })),
};

export const APP_1_RANK_DISTRIBUTION_HISTORY: RankDistributionHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    rank1: 1,
    rank2to3: 1,
    rank4to10: 1,
    rank11to50: 1,
    rank51plus: 0,
    unranked: 1 + (index % 2),
  })),
};

export const APP_1_CATEGORY_RANKS: CategoryRankSeries = {
  series: [
    {
      collection: "free",
      genre: "overall",
      genreName: "Overall",
      current: 42,
      depth: 100,
      points: Array.from({ length: 30 }, (_, index) => ({
        date: utcDaysAgo(29 - index),
        position: 60 - index,
      })),
    },
  ],
};

export const APP_1_REVIEWS: ReviewList = {
  total: 5,
  versions: ["3.4.1", "3.4.0"],
  reviews: [
    {
      id: "rev-1",
      reviewId: "store-rev-1",
      userName: "Casey",
      score: 5,
      title: "Love the focus timer",
      text: "Best pomodoro app I have used.",
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(1),
      repliedAt: null,
      replyText: null,
      reply: null,
    },
    {
      id: "rev-2",
      reviewId: "store-rev-2",
      userName: "Jordan",
      score: 2,
      title: "Crashes often",
      text: "It crashes when I start a session.",
      version: "3.4.0",
      reviewedAt: utcTimestampDaysAgo(3),
      repliedAt: null,
      replyText: null,
      reply: {
        text: "Sorry about the crash, Jordan. Version 3.4.1 fixes it; please update and tell us if it persists.",
        tone: "friendly",
        model: "gpt-test",
        generatedAt: utcTimestampDaysAgo(1),
        updatedAt: utcTimestampDaysAgo(1),
        repliedAt: null,
      },
    },
    {
      id: "rev-3",
      reviewId: "store-rev-3",
      userName: null,
      score: 1,
      title: null,
      text: "Please add dark mode.",
      version: "3.4.0",
      reviewedAt: utcTimestampDaysAgo(5),
      repliedAt: null,
      replyText: null,
      reply: null,
    },
    {
      id: "rev-4",
      reviewId: "store-rev-4",
      userName: "Sam",
      score: 4,
      title: null,
      text: "",
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(6),
      repliedAt: null,
      replyText: null,
      reply: {
        text: "Thank you!",
        tone: null,
        model: null,
        generatedAt: null,
        updatedAt: utcTimestampDaysAgo(2),
        repliedAt: utcTimestampDaysAgo(2),
      },
    },
    {
      id: "rev-5",
      reviewId: "store-rev-5",
      userName: "Robin",
      score: 4,
      title: "Fine",
      text: " \n ",
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(7),
      repliedAt: null,
      replyText: null,
      reply: null,
    },
  ],
};

export const APP_GP_REVIEWS: ReviewList = {
  total: 3,
  versions: ["2.8.0", "2.7.0"],
  reviews: [
    {
      id: "gp-rev-1",
      reviewId: "gp-store-rev-1",
      userName: "Lena",
      score: 2,
      title: "Stürzt ab",
      text: "Die App stürzt beim Start ab.",
      language: "de",
      version: "2.7.0",
      reviewedAt: utcTimestampDaysAgo(4),
      repliedAt: utcTimestampDaysAgo(3),
      replyText: "Danke für den Hinweis, Version 2.8.0 behebt den Absturz.",
      reply: null,
    },
    {
      id: "gp-rev-2",
      reviewId: "gp-store-rev-2",
      userName: "Jonas",
      score: 1,
      title: "Werbung",
      text: "Zu viel Werbung.",
      language: "de",
      version: "2.8.0",
      reviewedAt: utcTimestampDaysAgo(2),
      repliedAt: null,
      replyText: null,
      reply: null,
    },
    {
      id: "gp-rev-3",
      reviewId: "gp-store-rev-3",
      userName: "Mia",
      score: 4,
      title: "Jetzt besser",
      text: "Nach dem Update läuft es endlich.",
      language: "de",
      version: "2.8.0",
      reviewedAt: utcTimestampDaysAgo(1),
      repliedAt: utcTimestampDaysAgo(3),
      replyText: "Danke, das Update behebt den Fehler.",
      reply: null,
    },
  ],
};

export const REVIEW_TEXT_THAT_FITS =
  "The timer stops when the screen locks and I lose the whole session, which happens every morning on my commute. I reinstalled twice and the problem stays. Please fix the background mode because otherwise this is the best focus app I have tried this year.";

export const REVIEW_TEXT_THAT_OVERFLOWS = Array.from(
  { length: 6 },
  (_, line) => `Paragraph ${line + 1} of a review that keeps going.`,
).join("\n");

const LONG_LIST_TEXTS = [
  undefined,
  REVIEW_TEXT_THAT_FITS,
  REVIEW_TEXT_THAT_OVERFLOWS,
];

export const UNBROKEN_REVIEW_TITLE = "T".repeat(150);
export const UNBROKEN_REVIEW_TEXT = `https://example.com/${"verylongpath".repeat(40)}`;
export const UNBROKEN_REVIEW_AUTHOR = "A".repeat(200);

const LONG_LIST_OVERRIDES: Record<number, Partial<ReviewItem>> = {
  3: {
    title: UNBROKEN_REVIEW_TITLE,
    text: UNBROKEN_REVIEW_TEXT,
    userName: UNBROKEN_REVIEW_AUTHOR,
  },
};

export const APP_LONG_REVIEWS: ReviewList = {
  total: 60,
  versions: ["1.0.0"],
  reviews: Array.from({ length: 60 }, (_, index) => ({
    id: `long-rev-${index + 1}`,
    reviewId: `long-store-rev-${index + 1}`,
    userName: `Reviewer ${index + 1}`,
    score: (index % 5) + 1,
    title: `Review number ${index + 1}`,
    text: LONG_LIST_TEXTS[index] ?? `Long list review ${index + 1}.`,
    version: "1.0.0",
    reviewedAt: utcTimestampDaysAgo(index),
    repliedAt: null,
    replyText: null,
    reply: null,
    ...LONG_LIST_OVERRIDES[index],
  })),
};

export const EMPTY_REVIEW_THEMES: ReviewThemes = {
  themes: [],
  reviews: 0,
  negativeScoreMax: 2,
};

export const APP_1_REVIEW_THEMES: ReviewThemes = {
  themes: [
    { phrase: "crashes", kind: "complaint", mentions: 1, negative: 1 },
    { phrase: "dark mode", kind: "complaint", mentions: 1, negative: 1 },
    { phrase: "focus timer", kind: "praise", mentions: 1, negative: 0 },
  ],
  reviews: 5,
  negativeScoreMax: 2,
};

const updateReview = (
  index: number,
  text: string,
  replyText: string | null = null,
): ReviewItem => ({
  id: `update-rev-${index}`,
  reviewId: `update-store-rev-${index}`,
  userName: null,
  score: 1,
  title: null,
  text,
  version: "3.4.1",
  reviewedAt: utcTimestampDaysAgo(index),
  repliedAt: null,
  replyText,
  reply: null,
});

export const UPDATE_THEME_REVIEWS: ReviewList = {
  total: 5,
  versions: ["3.4.1"],
  reviews: [
    updateReview(1, "Since the update it lags."),
    updateReview(2, "The last update broke sync."),
    updateReview(3, "Updated today and now it crashes."),
    updateReview(4, "Updates keep failing."),
    updateReview(5, "Sync is slow.", "Please update to 3.4.1."),
  ],
};

const TWIN_DAY = utcTimestampDaysAgo(2);

const twinReview = (index: number, text: string): ReviewItem => ({
  id: `twin-rev-${index}`,
  reviewId: `twin-store-rev-${index}`,
  userName: "A Google user",
  score: 1,
  title: null,
  text,
  version: "3.4.1",
  reviewedAt: TWIN_DAY,
  repliedAt: null,
  replyText: null,
  reply: null,
});

export const TWIN_REVIEWS: ReviewList = {
  total: 3,
  versions: ["3.4.1"],
  reviews: [
    twinReview(1, "Broken one."),
    twinReview(2, "Broken two."),
    {
      ...twinReview(3, "Works for me."),
      userName: "Casey",
      score: 5,
    },
  ],
};

export const ARABIC_REVIEW_AUTHOR = "محمد";
export const ARABIC_REVIEW_TITLE = "التطبيق غير أمن !";
export const ARABIC_REVIEW_TEXT =
  "بسهوله يمكنهم اختراق الحساب و عند اختراق و تسجيل خروج من جميع الاجهزه $1.19 😡😡 تطبيق نصاب";
export const ARABIC_DEVELOPER_REPLY =
  "شكرا لك على ملاحظاتك، نعمل على إصلاح ذلك.";
export const HEBREW_REVIEW_TEXT = "עובד מצוין";
export const MIXED_REVIEW_TEXT = "Telegram עובד טוב";

export const RTL_REVIEWS: ReviewList = {
  total: 4,
  versions: ["3.4.1"],
  reviews: [
    {
      id: "rtl-rev-1",
      reviewId: "rtl-store-rev-1",
      userName: ARABIC_REVIEW_AUTHOR,
      score: 1,
      title: ARABIC_REVIEW_TITLE,
      text: ARABIC_REVIEW_TEXT,
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(1),
      repliedAt: utcTimestampDaysAgo(1),
      replyText: ARABIC_DEVELOPER_REPLY,
      reply: null,
    },
    {
      id: "rtl-rev-2",
      reviewId: "rtl-store-rev-2",
      userName: "דנה",
      score: 5,
      title: null,
      text: HEBREW_REVIEW_TEXT,
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(2),
      repliedAt: null,
      replyText: null,
      reply: null,
    },
    {
      id: "rtl-rev-3",
      reviewId: "rtl-store-rev-3",
      userName: "Sam",
      score: 4,
      title: "Mostly fine",
      text: MIXED_REVIEW_TEXT,
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(3),
      repliedAt: null,
      replyText: null,
      reply: null,
    },
    {
      id: "rtl-rev-4",
      reviewId: "rtl-store-rev-4",
      userName: "Casey",
      score: 5,
      title: "Great",
      text: "Works well.",
      version: "3.4.1",
      reviewedAt: utcTimestampDaysAgo(4),
      repliedAt: null,
      replyText: null,
      reply: null,
    },
  ],
};

export const UPDATE_REVIEW_THEMES: ReviewThemes = {
  themes: [{ phrase: "update", kind: "complaint", mentions: 2, negative: 2 }],
  reviews: 5,
  negativeScoreMax: 2,
};

export const REVIEW_TRANSLATION_EN = {
  title: "Crashes",
  text: "The app crashes on start.",
};

export const REVIEW_REPLY_DRAFT = {
  text: "Thanks for the kind words, Casey! Glad the focus timer keeps you on track.",
  language: "en",
};

export const REVIEW_REPLY_DRAFT_PLAY = {
  text: "Danke für dein Feedback, Jonas! Wir prüfen die Werbung im nächsten Update.",
  language: "de",
};

export const APP_1_RATINGS_HISTORY: RatingsHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    ratingAvg: 4.6 + (index % 4) * 0.05,
    ratingCount: 20000 + index * 130,
  })),
};

export const APP_1_RATINGS_HISTOGRAM: RatingsHistogram = {
  available: true,
  counts: { 1: 420, 2: 310, 3: 940, 4: 4820, 5: 17230 },
  total: 23720,
  capturedAt: utcDaysAgo(1),
};

export const APP_1_COMPETITORS: CompetitorItem[] = [
  {
    id: "comp-1",
    store: "APP_STORE",
    name: "Rival Focus",
    iconUrl: null,
    latestSnapshot: {
      id: "snap-comp-1",
      title: "Rival Focus",
      subtitle: "Deep work timer",
      summary: null,
      ratingAvg: 4.5,
      ratingCount: 12000,
      installs: null,
      price: 0,
      version: "2.1.0",
      capturedAt: utcTimestampDaysAgo(0),
    },
  },
];

export const APP_1_DETAIL: AppDetail = {
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "123456789",
  country: "us",
  name: "Focus Timer",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(30),
  searchable: true,
  latestSnapshot: {
    id: "snap-1",
    title: "Focus Timer",
    subtitle: "Pomodoro & deep work",
    summary: "Stay focused with timed work sessions.",
    ratingAvg: 4.8,
    ratingCount: 24000,
    installs: null,
    price: 0,
    version: "3.4.1",
    capturedAt: utcTimestampDaysAgo(0),
  },
  competitors: APP_1_COMPETITORS,
  group: null,
};

export const APP_1_LISTING_MARKETS: ListingMarket[] = [
  {
    country: "us",
    home: true,
    capturedAt: utcTimestampDaysAgo(0),
    tracked: true,
  },
  {
    country: "pl",
    home: false,
    capturedAt: utcTimestampDaysAgo(0),
    tracked: true,
    localizations: ["pl"],
  },
];

export const APP_1_PL_DETAIL: AppDetail = {
  ...APP_1_DETAIL,
  latestSnapshot: {
    id: "snap-1-pl",
    title: "Minutnik Skupienia",
    subtitle: "Pomodoro i praca głęboka",
    summary: "Pracuj skupiony w odmierzonych sesjach.",
    ratingAvg: 4.6,
    ratingCount: 3100,
    installs: null,
    price: 0,
    version: "3.4.1",
    capturedAt: utcTimestampDaysAgo(0),
    country: "pl",
  },
  competitors: [],
};

export const APP_1: AppListItem = {
  id: "app-1",
  store: "APP_STORE",
  country: "us",
  name: "Focus Timer",
  iconUrl: null,
  ratingAvg: 4.8,
  ratingCount: 24000,
  capturedAt: utcTimestampDaysAgo(0),
  trackedKeywordCount: 5,
  competitorCount: 1,
  groupId: null,
};

export const APP_1_DE_DETAIL: AppDetail = {
  id: "app-1-de",
  store: "APP_STORE",
  storeAppId: "123456789",
  country: "de",
  name: "Focus Timer",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(24),
  searchable: true,
  latestSnapshot: {
    id: "snap-1-de",
    title: "Focus Timer",
    subtitle: "Pomodoro & Tiefenarbeit",
    summary: "Bleib fokussiert mit getakteten Arbeitsphasen.",
    ratingAvg: 4.6,
    ratingCount: 3100,
    installs: null,
    price: 0,
    version: "3.4.1",
    capturedAt: utcTimestampDaysAgo(0),
  },
  competitors: [],
  group: null,
};

export const APP_2_SUMMARY: AppSummary = {
  visibility: { current: 10, delta7d: null, delta30d: null },
  rankDistribution: {
    top1: 0,
    top3: 0,
    top10: 0,
    top50: 0,
    beyond: 0,
    unranked: 0,
  },
  movers: { up: [], down: [] },
  coverage: {
    inTitle: 0,
    inSubtitle: 0,
    inDescription: 0,
    uncoveredHighOpportunity: [],
  },
  lastRefreshAt: null,
  trackedKeywords: 0,
  competitors: 0,
};

export const APP_2_DETAIL: AppDetail = {
  id: "app-2",
  store: "APP_STORE",
  storeAppId: "987654321",
  country: "us",
  name: "Habit Tracker",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(20),
  searchable: true,
  latestSnapshot: {
    id: "snap-2",
    title: "Habit Tracker",
    subtitle: "Build better routines",
    summary: null,
    ratingAvg: 4.2,
    ratingCount: 800,
    installs: null,
    price: 0,
    version: "1.0.0",
    capturedAt: utcTimestampDaysAgo(1),
  },
  competitors: [],
  group: null,
};

export const STORE_SEARCH_ICON_URL =
  "https://is1-ssl.mzstatic.com/image/thumb/e2e-focus-timer/512x512bb.png";

export const STORE_SEARCH: Record<
  "APP_STORE" | "GOOGLE_PLAY",
  StoreSearchResult[]
> = {
  APP_STORE: [
    {
      storeAppId: "123456789",
      title: "Focus Timer",
      developer: "Acme",
      ratingAvg: 4.6,
      ratingCount: 1200,
      iconUrl: STORE_SEARCH_ICON_URL,
    },
    {
      storeAppId: "987654321",
      title: "Focus Keeper",
      developer: "Keeper Labs",
      ratingAvg: 4.4,
      ratingCount: 830,
      iconUrl: null,
    },
    {
      storeAppId: "555000333",
      title: "Focused Study",
      developer: null,
      ratingAvg: null,
      ratingCount: null,
      iconUrl: null,
    },
  ],
  GOOGLE_PLAY: [
    {
      storeAppId: "com.fokus.timer",
      title: "Fokus Timer",
      developer: "Fokus GmbH",
      ratingAvg: 4.3,
      ratingCount: 5400,
      iconUrl: null,
    },
    {
      storeAppId: "com.fokus.lernen",
      title: "Fokus Lernen",
      developer: "Lernwerk",
      ratingAvg: 4.1,
      ratingCount: 900,
      iconUrl: null,
    },
  ],
};

export const SIMILAR_ICON_URL =
  "https://is1-ssl.mzstatic.com/image/thumb/e2e-deep-focus-pro/512x512bb.png";

export const SIMILAR_APPS: Record<
  string,
  { similar: SimilarLookupState; items: CompetitorSuggestion[] }
> = {
  "app-1": {
    similar: "ok",
    items: [
      {
        storeAppId: "555000444",
        title: "Deep Focus Pro",
        developer: "Calm Works",
        iconUrl: SIMILAR_ICON_URL,
        source: "similar",
        appearances: null,
        bestPosition: null,
      },
      {
        storeAppId: "555000555",
        title: "Study Bunny",
        developer: null,
        iconUrl: null,
        source: "similar",
        appearances: null,
        bestPosition: null,
      },
    ],
  },
  "app-new": { similar: "unavailable", items: [] },
};

export const STORE_LOOKUP_LIMIT = 60;

export function storeLookupRefusedEnvelope(path: string): ApiErrorEnvelope {
  return {
    statusCode: 429,
    error: "Too Many Requests",
    message: `Store lookup limit reached: the indie plan allows ${STORE_LOOKUP_LIMIT} requests per hour. Wait ${RATE_LIMIT_RESET_SECONDS} seconds before the next one, because retrying before then will fail.`,
    path,
    timestamp: new Date().toISOString(),
    rateLimit: {
      window: "hour",
      rateClass: "store",
      plan: "indie",
      limit: STORE_LOOKUP_LIMIT,
      resetSeconds: RATE_LIMIT_RESET_SECONDS,
      upgradeTo: "ultimate",
      action: "storeLookup",
    },
    retryAfterSeconds: RATE_LIMIT_RESET_SECONDS,
  };
}

export const APP_2_ICON_URL =
  "https://is1-ssl.mzstatic.com/image/thumb/e2e-habit-tracker/512x512bb.png";

export const APP_2: AppListItem = {
  id: "app-2",
  store: "APP_STORE",
  country: "us",
  name: "Habit Tracker",
  iconUrl: APP_2_ICON_URL,
  ratingAvg: 4.2,
  ratingCount: 800,
  capturedAt: utcTimestampDaysAgo(1),
  trackedKeywordCount: 0,
  competitorCount: 0,
  groupId: null,
};

export const IMPORTED_APP_DETAIL: AppDetail = {
  id: "app-new",
  store: "APP_STORE",
  storeAppId: "123456789",
  country: "us",
  name: "Imported App",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(0),
  searchable: true,
  latestSnapshot: null,
  competitors: [],
  group: null,
};

export const IMPORTED_APP: AppListItem = {
  id: "app-new",
  store: "APP_STORE",
  country: "us",
  name: "Imported App",
  iconUrl: null,
  ratingAvg: null,
  ratingCount: null,
  capturedAt: utcTimestampDaysAgo(0),
  trackedKeywordCount: 0,
  competitorCount: 0,
  groupId: null,
};

const EMPTY_RANKINGS: RankingSeries = { series: [] };
const EMPTY_VISIBILITY: VisibilityHistory = { points: [] };
const SPARSE_VISIBILITY: VisibilityHistory = {
  points: [
    { date: utcDaysAgo(1), visibility: 41 },
    { date: utcDaysAgo(0), visibility: 44 },
  ],
};
const EMPTY_RANK_DISTRIBUTION_HISTORY: RankDistributionHistory = { points: [] };
const EMPTY_CATEGORY_RANKS: CategoryRankSeries = { series: [] };
const EMPTY_REVIEWS: ReviewList = { reviews: [], total: 0, versions: [] };
const EMPTY_RATINGS_HISTORY: RatingsHistory = { points: [] };

const EMPTY_RATINGS_HISTOGRAM: RatingsHistogram = {
  available: false,
  counts: null,
  total: null,
  capturedAt: null,
};
const EMPTY_SERP_MOVERS: SerpMovers = { windowDays: 7, items: [] };
const EMPTY_CHANGES: ChangeTimeline = { events: [] };
const EMPTY_DISCOVERY: CompetitorDiscovery = { windowDays: 30, items: [] };
const EMPTY_COMPARISON: KeywordComparison = { competitors: [], rows: [] };

export const APP_1_DE_DISCOVERY: CompetitorDiscovery = {
  windowDays: 30,
  items: [
    {
      storeAppId: "555000333",
      title: "Fokus Meister",
      developer: "Nordlys Labs",
      ratingAvg: 4.5,
      ratingCount: 2200,
      appearances: 8,
      keywordCount: 2,
      bestPosition: 4,
      avgPosition: 8.5,
      keywords: ["fokus timer", "pomodoro"],
    },
  ],
};

const APP_1_DISCOVERY: CompetitorDiscovery = {
  windowDays: 30,
  items: [
    {
      storeAppId: "555000111",
      title: "Deep Work Sessions",
      developer: "Nordlys Labs",
      ratingAvg: 4.7,
      ratingCount: 8400,
      appearances: 14,
      keywordCount: 4,
      bestPosition: 2,
      avgPosition: 6.5,
      keywords: ["focus timer", "pomodoro", "study timer", "time blocking"],
    },
    {
      storeAppId: "555000222",
      title: "Tomato Clock",
      developer: "Bitwise Studio",
      ratingAvg: 4.1,
      ratingCount: 1900,
      appearances: 9,
      keywordCount: 2,
      bestPosition: 5,
      avgPosition: 11.5,
      keywords: ["pomodoro", "study timer"],
    },
  ],
};

const APP_1_COMPARISON: KeywordComparison = {
  competitors: [{ id: "comp-1", name: "Rival Focus" }],
  rows: [
    {
      keywordId: "kw-1",
      text: "focus timer",
      country: "us",
      traffic: 55,
      difficulty: 4,
      you: 3,
      positions: { "comp-1": 9 },
      gap: false,
    },
    {
      keywordId: "kw-2",
      text: "pomodoro",
      country: "us",
      traffic: 70,
      difficulty: 7,
      you: 12,
      positions: { "comp-1": 4 },
      gap: false,
    },
    {
      keywordId: "kw-4",
      text: "productivity app",
      country: "us",
      traffic: 65,
      difficulty: 6,
      you: null,
      positions: { "comp-1": 8 },
      gap: true,
    },
    {
      keywordId: "kw-5",
      text: "time blocking",
      country: "us",
      traffic: null,
      difficulty: null,
      you: 45,
      positions: { "comp-1": null },
      gap: false,
    },
    {
      keywordId: "kw-de-1",
      text: "pomodoro",
      country: "de",
      traffic: 5,
      difficulty: 3,
      you: 7,
      positions: { "comp-1": 2 },
      gap: false,
    },
  ],
};

export const CROWDED_COMPETITORS_COOKIE = "e2e_crowded_competitors";
export const CROWDED_ICON_URL =
  "https://is1-ssl.mzstatic.com/image/thumb/e2e-rival/512x512bb.png";

export const CROWDED_RIVALS = Array.from({ length: 12 }, (_, index) => ({
  id: `rival-${index + 1}`,
  name: `Rival Focus Timer Pro ${index + 1}`,
}));

export const CROWDED_COMPETITORS: CompetitorItem[] = CROWDED_RIVALS.map(
  ({ id, name }) => ({
    id,
    store: "APP_STORE",
    name,
    iconUrl: CROWDED_ICON_URL,
    latestSnapshot: null,
  }),
);

export const CROWDED_COMPARISON: KeywordComparison = {
  competitors: CROWDED_RIVALS,
  rows: APP_1_COMPARISON.rows.map((row, rowIndex) => ({
    ...row,
    positions: Object.fromEntries(
      CROWDED_RIVALS.map(({ id }, index) => [
        id,
        (index + rowIndex) % 4 === 0 ? null : index * 7 + rowIndex + 1,
      ]),
    ),
  })),
};

export const UNCHECKED_COMPARISON_COOKIE = "e2e_unchecked_competitor";

export const UNCHECKED_COMPARISON: KeywordComparison = {
  competitors: [{ id: "comp-1", name: "Rival Focus" }],
  rows: [
    {
      keywordId: "kw-1",
      text: "focus timer",
      country: "us",
      traffic: 5,
      difficulty: 3,
      you: 3,
      positions: { "comp-1": null },
      gap: false,
      unchecked: ["comp-1"],
    },
    {
      keywordId: "kw-4",
      text: "productivity app",
      country: "us",
      traffic: 5,
      difficulty: 3,
      you: null,
      positions: { "comp-1": 8 },
      gap: true,
      unchecked: ["app-1"],
    },
    {
      keywordId: "kw-5",
      text: "time blocking",
      country: "us",
      traffic: 5,
      difficulty: 3,
      you: 45,
      positions: { "comp-1": null },
      gap: false,
    },
  ],
};

const e2eScreenshotUrl = (position: number): string =>
  `https://is1-ssl.mzstatic.com/image/thumb/e2e-focus/${position}.jpg/392x696bb.jpg`;
export const APP_1_PL_CHANGES: ChangeTimeline = {
  events: [
    {
      id: "chg-pl-loc-1",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "title",
      before: "Minutnik Pracy",
      after: "Skupienie: Minutnik Pracy",
      capturedAt: utcTimestampDaysAgo(1),
      country: "pl",
      localization: "pl",
    },
    {
      id: "chg-pl-1",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "title",
      before: "Minutnik",
      after: "Minutnik Skupienia",
      capturedAt: utcTimestampDaysAgo(2),
      country: "pl",
    },
    {
      id: "chg-pl-sc-1",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "screenshotImages",
      before: "2 screenshots",
      after: "2 screenshots, 1 replaced",
      capturedAt: utcTimestampDaysAgo(3),
      country: "pl",
      detail: {
        kind: "images",
        before: [11, 12].map((asset, index) => ({
          position: index + 1,
          url: e2eScreenshotUrl(asset),
        })),
        after: [11, 13].map((asset, index) => ({
          position: index + 1,
          url: e2eScreenshotUrl(asset),
        })),
        added: [2],
        removed: [2],
        reordered: false,
      },
    },
  ],
};

const APP_1_CHANGES: ChangeTimeline = {
  events: [
    {
      id: "app-chg-1",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "title",
      before: "Focus Timer",
      after: "Focus Timer Pro",
      capturedAt: utcTimestampDaysAgo(1),
    },
    {
      id: "app-chg-2",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "description",
      before: "1840",
      after: "2210",
      capturedAt: utcTimestampDaysAgo(1),
    },
    {
      id: "app-chg-sc-1",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "screenshotImages",
      before: "3 screenshots",
      after: "3 screenshots, 1 replaced",
      capturedAt: utcTimestampDaysAgo(2),
      detail: {
        kind: "images",
        before: [1, 2, 3].map((position) => ({
          position,
          url: e2eScreenshotUrl(position),
        })),
        after: [1, 5, 3].map((asset, index) => ({
          position: index + 1,
          url: e2eScreenshotUrl(asset),
        })),
        added: [2],
        removed: [2],
        reordered: false,
      },
    },
    {
      id: "app-chg-sc-2",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "screenshotCaptions",
      before: "Focus timer for deep work | Plan your week",
      after: "Focus timer for deep work | Plan your day",
      capturedAt: utcTimestampDaysAgo(2),
      detail: {
        kind: "captions",
        added: ["Plan your day"],
        removed: ["Plan your week"],
      },
    },
    {
      id: "app-chg-sc-3",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "screenshots",
      before: "3",
      after: "4",
      capturedAt: utcTimestampDaysAgo(3),
      detail: {
        kind: "images",
        before: [1, 2, 3].map((position) => ({
          position,
          url: e2eScreenshotUrl(position),
        })),
        after: [1, 2, 3, 4].map((position) => ({
          position,
          url: e2eScreenshotUrl(position),
        })),
        added: [4],
        removed: [],
        reordered: false,
      },
    },
    {
      id: "app-chg-3",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "price",
      before: "0",
      after: "4.99",
      capturedAt: utcTimestampDaysAgo(4),
    },
    {
      id: "app-chg-4",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "screenshots",
      before: "5",
      after: "8",
      capturedAt: utcTimestampDaysAgo(4),
    },
    {
      id: "app-chg-8",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "whatsNew",
      before: "v2.7\n- Calmer sounds",
      after:
        "v2.8\n- New stickers\n- Type <Username> to mention\n- Faster sync &amp; backup",
      capturedAt: utcTimestampDaysAgo(4),
    },
    {
      id: "app-chg-5",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "icon",
      before: null,
      after: null,
      capturedAt: utcTimestampDaysAgo(12),
    },
    {
      id: "app-chg-6",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "version",
      before: "2.3.0",
      after: "2.4.0",
      capturedAt: utcTimestampDaysAgo(40),
    },
    {
      id: "app-chg-7",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "screenshots",
      before: "6",
      after: "8",
      capturedAt: utcTimestampDaysAgo(70),
    },
  ],
};

function openWindow(
  status: "pending" | "unmeasured",
  changedDaysAgo: number,
  days: ChangeImpactWindowDays,
  overlappingChanges: string[] = [],
): ChangeImpactWindow {
  return {
    days,
    status,
    targetDate: utcDaysAgo(changedDaysAgo - days),
    measuredOn: null,
    movement: null,
    medianPositionChange: null,
    visibilityBefore: null,
    visibilityAfter: null,
    visibilityChange: null,
    overlappingChanges,
  };
}

function emptyChangeImpact(detail: AppDetail): ChangeImpactReport {
  return {
    appId: detail.id,
    country: detail.country,
    days: 90,
    totalChanges: 0,
    items: [],
  };
}

export const APP_1_CHANGE_IMPACT: ChangeImpactReport = {
  appId: "app-1",
  country: "us",
  days: 90,
  totalChanges: 4,
  items: [
    {
      changedOn: utcDaysAgo(1),
      fields: ["title", "description"],
      baselineDate: utcDaysAgo(2),
      windows: [
        openWindow("pending", 1, 7),
        openWindow("pending", 1, 14),
        openWindow("pending", 1, 28),
      ],
    },
    {
      changedOn: utcDaysAgo(12),
      fields: ["icon"],
      baselineDate: utcDaysAgo(13),
      windows: [
        {
          days: 7,
          status: "measured",
          targetDate: utcDaysAgo(5),
          measuredOn: utcDaysAgo(5),
          movement: {
            improved: 2,
            declined: 1,
            unchanged: 1,
            entered: 1,
            exited: 0,
            measured: 5,
          },
          medianPositionChange: -3,
          visibilityBefore: 38.4,
          visibilityAfter: 42.1,
          visibilityChange: 3.7,
          overlappingChanges: [],
        },
        openWindow("pending", 12, 14, [utcDaysAgo(1)]),
        openWindow("pending", 12, 28, [utcDaysAgo(1)]),
      ],
    },
    {
      changedOn: utcDaysAgo(40),
      fields: ["version"],
      baselineDate: utcDaysAgo(41),
      windows: [
        {
          days: 7,
          status: "measured",
          targetDate: utcDaysAgo(33),
          measuredOn: utcDaysAgo(34),
          movement: {
            improved: 1,
            declined: 2,
            unchanged: 1,
            entered: 0,
            exited: 1,
            measured: 5,
          },
          medianPositionChange: 2,
          visibilityBefore: 40.2,
          visibilityAfter: 37.9,
          visibilityChange: -2.3,
          overlappingChanges: [],
        },
        openWindow("unmeasured", 40, 14),
        {
          days: 28,
          status: "measured",
          targetDate: utcDaysAgo(12),
          measuredOn: utcDaysAgo(12),
          movement: {
            improved: 3,
            declined: 1,
            unchanged: 1,
            entered: 0,
            exited: 0,
            measured: 5,
          },
          medianPositionChange: -1,
          visibilityBefore: 40.2,
          visibilityAfter: 41.5,
          visibilityChange: 1.3,
          overlappingChanges: [utcDaysAgo(12)],
        },
      ],
    },
    {
      changedOn: utcDaysAgo(70),
      fields: ["screenshots"],
      baselineDate: null,
      windows: [
        openWindow("unmeasured", 70, 7),
        openWindow("unmeasured", 70, 14),
        openWindow("unmeasured", 70, 28),
      ],
    },
  ],
};

const LONG_NAME =
  "Deep Focus Pomodoro Timer and Habit Builder for Students and Remote Teams Pro";
const LONG_KEYWORD = "best pomodoro focus timer for students and remote teams";

export const APP_LONG_DETAIL: AppDetail = {
  id: "app-long",
  store: "APP_STORE",
  storeAppId: "555123456",
  country: "us",
  name: LONG_NAME,
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(10),
  searchable: true,
  latestSnapshot: {
    id: "snap-long",
    title: LONG_NAME,
    subtitle:
      "Stay in flow with long uninterrupted deep work sessions every single day",
    summary: null,
    ratingAvg: 4.9,
    ratingCount: 1234567,
    installs: null,
    price: 12.99,
    version: "10.11.12",
    capturedAt: utcTimestampDaysAgo(0),
  },
  competitors: [],
  group: null,
};

export const APP_LONG_KEYWORDS: TrackedKeywordItem[] = [
  {
    keywordId: "kw-long-1",
    text: LONG_KEYWORD,
    country: "us",
    serpVolatility7d: 91,
    source: "MANUAL",
    active: true,
    latestPosition: 137,
    latestDepth: RANK_DEPTH,
    previousPosition: 12,
    positionDelta1d: 125,
    positionDelta7d: -118,
    traffic: 88,
    difficulty: 97,
    volume: 1234567,
    relevance: 100,
    opportunity: 99,
    bucket: "primary",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: null,
  },
];

export const BULK_KEYWORD_COUNT = 500;

export const APP_BULK_KEYWORDS: TrackedKeywordItem[] = Array.from(
  { length: BULK_KEYWORD_COUNT },
  (_, index) => ({
    keywordId: `kw-bulk-${index + 1}`,
    text: `bulk keyword ${index + 1}`,
    country: "us",
    serpVolatility7d: index % 100,
    source: "MANUAL" as const,
    active: index % 17 !== 0,
    latestPosition: index % 7 === 0 ? null : (index % 200) + 1,
    latestDepth: RANK_DEPTH,
    previousPosition: index % 5 === 0 ? null : (index % 200) + 3,
    positionDelta1d: index % 3 === 0 ? null : (index % 11) - 5,
    positionDelta7d: index % 4 === 0 ? null : (index % 13) - 6,
    traffic: index % 100,
    difficulty: index % 10,
    volume: 100 * (index % 90),
    relevance: index % 100,
    opportunity: index % 100,
    bucket: "secondary" as const,
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: null,
  }),
);

export const APP_UNCHECKED_TEXTS = ["geo guess game", "where am i"] as const;

export const APP_UNCHECKED_KEYWORDS: TrackedKeywordItem[] =
  APP_UNCHECKED_TEXTS.map((text, index) => ({
    keywordId: `kw-unchecked-${index + 1}`,
    text,
    country: "us",
    serpVolatility7d: null,
    source: "TITLE" as const,
    active: true,
    latestPosition: null,
    latestDepth: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
  }));

export const APP_UNCHECKED_SUMMARY: AppSummary = {
  ...APP_2_SUMMARY,
  trackedKeywords: APP_UNCHECKED_KEYWORDS.length,
};

export const APP_UNCHECKED_DETAIL: AppDetail = {
  ...APP_LONG_DETAIL,
  id: "app-unchecked",
  name: "Freshly Imported App",
};

export const APP_IPAD_ONLY_DETAIL: AppDetail = {
  ...APP_LONG_DETAIL,
  id: "app-ipad-only",
  name: "Procreate",
  searchable: false,
};

export const APP_UNCHECKED_RANKINGS: RankingSeries = {
  series: APP_UNCHECKED_KEYWORDS.map((keyword) => ({
    keywordId: keyword.keywordId,
    text: keyword.text,
    store: "APP_STORE" as const,
    country: "us",
    points: [],
  })),
};

export const APP_BULK_DETAIL: AppDetail = {
  ...APP_LONG_DETAIL,
  id: "app-bulk",
  name: "Bulk Keywords App",
};

export const APP_COMBOS_KEYWORD_FIELD = "mood tracker,daily planner,water";

const APP_COMBOS_TRACKED: ReadonlyArray<
  readonly [string, KeywordSource, boolean]
> = [
  ["mood journal", "TITLE", true],
  ["mood tracker", "KEYWORD_FIELD", true],
  ["daily planner", "KEYWORD_FIELD", true],
  ["water", "KEYWORD_FIELD", true],
  ["sleep notes app", "MANUAL", true],
  ["diary daily", "MANUAL", true],
  ["gratitude", "MANUAL", false],
];

export const APP_COMBOS_KEYWORDS: TrackedKeywordItem[] = APP_COMBOS_TRACKED.map(
  ([text, source, active], index) => ({
    keywordId: `kw-combos-${index + 1}`,
    text,
    country: "us",
    serpVolatility7d: null,
    source,
    active,
    latestPosition: null,
    latestDepth: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
  }),
);

export const APP_COMBOS_DETAIL: AppDetail = {
  id: "app-combos",
  store: "APP_STORE",
  storeAppId: "555987654",
  country: "us",
  name: "Mood Journal",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(12),
  searchable: true,
  latestSnapshot: {
    id: "snap-combos",
    title: "Mood Journal: Daily Diary",
    subtitle: "Gratitude log & sleep notes",
    summary: "Write a short entry every evening.",
    ratingAvg: 4.6,
    ratingCount: 2100,
    installs: null,
    price: 0,
    version: "2.3.0",
    capturedAt: utcTimestampDaysAgo(0),
  },
  competitors: [],
  group: null,
};

export const APP_LONG_ICON_URL =
  "https://is1-ssl.mzstatic.com/image/thumb/e2e-deep-focus/512x512bb.png";

export const APP_LONG: AppListItem = {
  id: "app-long",
  store: "APP_STORE",
  country: "us",
  name: LONG_NAME,
  iconUrl: APP_LONG_ICON_URL,
  ratingAvg: 4.9,
  ratingCount: 1234567,
  capturedAt: utcTimestampDaysAgo(0),
  trackedKeywordCount: 1,
  competitorCount: 0,
  groupId: null,
};

const GP_SHORT_DESCRIPTION =
  "Fokus Timer für Pomodoro Sessions, ruhige Lernphasen und produktive Arbeitswoche";

export const APP_GP_KEYWORDS: TrackedKeywordItem[] = [
  {
    keywordId: "kw-gp-1",
    text: "pomodoro timer",
    country: "de",
    serpVolatility7d: 12,
    source: "TITLE",
    active: true,
    latestPosition: 4,
    latestDepth: RANK_DEPTH,
    previousPosition: 6,
    positionDelta1d: -2,
    positionDelta7d: -5,
    traffic: 48,
    difficulty: 5,
    volume: 4200,
    relevance: 88,
    opportunity: 76,
    bucket: "primary",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: {
      source: "GOOGLE_PLAY_PREFIX_SEARCH",
      formulaVersion: "google-play-v1",
      confidence: "HIGH",
      capturedAt: utcTimestampDaysAgo(0),
    },
  },
  {
    keywordId: "kw-gp-2",
    text: "lernphasen timer",
    country: "de",
    serpVolatility7d: 28,
    source: "DESCRIPTION",
    active: true,
    latestPosition: 18,
    latestDepth: RANK_DEPTH,
    previousPosition: 15,
    positionDelta1d: 3,
    positionDelta7d: 4,
    traffic: 32,
    difficulty: 4,
    volume: 1800,
    relevance: 64,
    opportunity: 52,
    bucket: "secondary",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: {
      source: "GOOGLE_PLAY_PREFIX_SEARCH",
      formulaVersion: "google-play-v1",
      confidence: "MEDIUM",
      capturedAt: utcTimestampDaysAgo(1),
    },
  },
  {
    keywordId: "kw-gp-3",
    text: "fokus app",
    country: "de",
    serpVolatility7d: null,
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: RANK_DEPTH,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: 58,
    difficulty: 7,
    volume: 6100,
    relevance: 72,
    opportunity: 74,
    bucket: "aspirational",
    scoredAt: utcTimestampDaysAgo(0),
    scoreProvenance: null,
  },
];

export const APP_GP_RANKINGS: RankingSeries = {
  series: [
    {
      keywordId: "kw-gp-1",
      text: "pomodoro timer",
      store: "GOOGLE_PLAY" as const,
      country: "de",
      points: pointsFrom([9, 8, 8, 7, 6, 6, 6, 4]),
    },
    {
      keywordId: "kw-gp-2",
      text: "lernphasen timer",
      store: "GOOGLE_PLAY" as const,
      country: "de",
      points: pointsFrom([14, 14, 15, 15, 16, 16, 15, 18]),
    },
    {
      keywordId: "kw-gp-3",
      text: "fokus app",
      store: "GOOGLE_PLAY" as const,
      country: "de",
      points: pointsFrom([null, null, null, null, null, null, null, null]),
    },
  ],
};

export const APP_GP_SERP_MOVERS: SerpMovers = {
  windowDays: 7,
  items: [
    {
      date: utcDaysAgo(1),
      keywordId: "kw-gp-1",
      text: "pomodoro timer",
      position: 3,
      storeAppId: "com.nordlys.tiefenfokus",
      title: "Tiefenfokus",
      appId: "comp-gp-1",
      isCompetitor: true,
    },
    {
      date: utcDaysAgo(2),
      keywordId: "kw-gp-2",
      text: "lernphasen timer",
      position: 8,
      storeAppId: "com.silberapps.lernzeit",
      title: "Lernzeit",
      appId: null,
      isCompetitor: false,
    },
  ],
};

export const APP_GP_SUMMARY: AppSummary = {
  visibility: { current: 24.8, delta7d: 3, delta30d: 6 },
  rankDistribution: {
    top1: 0,
    top3: 0,
    top10: 1,
    top50: 2,
    beyond: 0,
    unranked: 1,
  },
  movers: {
    up: [
      {
        keywordId: "kw-gp-1",
        text: "pomodoro timer",
        from: 9,
        fromDepth: RANK_DEPTH,
        to: 4,
        toDepth: RANK_DEPTH,
      },
    ],
    down: [
      {
        keywordId: "kw-gp-2",
        text: "lernphasen timer",
        from: 14,
        fromDepth: RANK_DEPTH,
        to: 18,
        toDepth: RANK_DEPTH,
      },
    ],
  },
  coverage: {
    inTitle: 2,
    inSubtitle: 0,
    inDescription: 2,
    uncoveredHighOpportunity: [
      { keywordId: "kw-gp-3", text: "fokus app", opportunity: 74 },
    ],
  },
  lastRefreshAt: utcTimestampDaysAgo(0),
  trackedKeywords: 3,
  competitors: 1,
};

export const APP_GP_VISIBILITY: VisibilityHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    visibility: 18 + (index % 9),
  })),
};

export const APP_GP_DISCOVERY: CompetitorDiscovery = {
  windowDays: 30,
  items: [
    {
      storeAppId: "com.silberapps.lernzeit",
      title: "Lernzeit",
      developer: "Silber Apps",
      ratingAvg: 4.3,
      ratingCount: 6100,
      appearances: 11,
      keywordCount: 2,
      bestPosition: 6,
      avgPosition: 9.5,
      keywords: ["pomodoro timer", "lernphasen timer"],
    },
    {
      storeAppId: "com.hafen.konzentration",
      title: "Konzentration Pur",
      developer: "Hafen Software",
      ratingAvg: 4.0,
      ratingCount: 900,
      appearances: 6,
      keywordCount: 1,
      bestPosition: 12,
      avgPosition: 17,
      keywords: ["fokus app"],
    },
  ],
};

export const APP_GP_COMPETITORS: CompetitorItem[] = [
  {
    id: "comp-gp-1",
    store: "GOOGLE_PLAY",
    name: "Tiefenfokus",
    iconUrl: null,
    latestSnapshot: {
      id: "snap-comp-gp-1",
      title: "Tiefenfokus",
      subtitle: null,
      summary: "Tiefe Arbeitsblöcke, klare Pausen und ein ruhiger Fokus Timer",
      ratingAvg: 4.6,
      ratingCount: 21000,
      installs: 1200000,
      price: 0,
      version: "5.2.0",
      capturedAt: utcTimestampDaysAgo(0),
    },
  },
];

export const APP_GP_DETAIL: AppDetail = {
  id: "app-gp",
  store: "GOOGLE_PLAY",
  storeAppId: "com.bitwise.tomatoclock",
  country: "de",
  name: "Tomato Clock",
  iconUrl: null,
  createdAt: utcTimestampDaysAgo(25),
  searchable: true,
  latestSnapshot: {
    id: "snap-gp",
    title: "Tomato Clock",
    subtitle: null,
    summary: GP_SHORT_DESCRIPTION,
    ratingAvg: 4.4,
    ratingCount: 5200,
    installs: 500000,
    price: 0,
    version: "2.8.0",
    capturedAt: utcTimestampDaysAgo(0),
  },
  competitors: APP_GP_COMPETITORS,
  group: null,
};

export const APP_GP: AppListItem = {
  id: "app-gp",
  store: "GOOGLE_PLAY",
  country: "de",
  name: "Tomato Clock",
  iconUrl: null,
  ratingAvg: 4.4,
  ratingCount: 5200,
  capturedAt: utcTimestampDaysAgo(0),
  trackedKeywordCount: 3,
  competitorCount: 1,
  groupId: null,
};

export interface AppDataset {
  detail: AppDetail;
  summary: AppSummary;
  keywords: TrackedKeywordItem[];
  rankings: RankingSeries;
  serpMovers: SerpMovers;
  visibility: VisibilityHistory;
  rankDistributionHistory: RankDistributionHistory;
  categoryRanks: CategoryRankSeries;
  competitors: CompetitorItem[];
  reviews: ReviewList;
  reviewThemes?: ReviewThemes;
  ratingsHistory: RatingsHistory;
  ratingsHistogram: RatingsHistogram;
  changes: ChangeTimeline;
  changeImpact: ChangeImpactReport;
  discovery: CompetitorDiscovery;
  comparison: KeywordComparison;
}

const newAppKeyword = (
  index: number,
  text: string,
  position: number | null,
  depth: number | null,
): TrackedKeywordItem => ({
  keywordId: `kw-new-${index}`,
  text,
  country: "us",
  serpVolatility7d: null,
  source: index <= 2 ? "TITLE" : "SUBTITLE",
  active: true,
  latestPosition: position,
  latestDepth: depth,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: null,
  opportunity: null,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
});

export const APP_NEW_KEYWORDS: TrackedKeywordItem[] = [
  newAppKeyword(1, "focus timer", 2, RANK_DEPTH),
  newAppKeyword(2, "pomodoro", 15, RANK_DEPTH),
  newAppKeyword(3, "study timer", 40, RANK_DEPTH),
  newAppKeyword(4, "deep work timer", null, RANK_DEPTH),
  newAppKeyword(5, "break timer", null, null),
  newAppKeyword(6, "task timer", null, null),
  newAppKeyword(7, "flow timer", null, null),
  newAppKeyword(8, "exam timer", null, null),
];

const listingSuggestions = (texts: string[]): KeywordSuggestion[] =>
  texts.map((text) => ({ text, strategy: "metadata" }));

export const SUGGESTIONS: Record<
  string,
  Partial<Record<KeywordSuggestionStrategy, KeywordSuggestion[]>>
> = {
  "app-1": {
    metadata: listingSuggestions([
      "deep focus",
      "pomodoro timer",
      "study sessions",
      "focus timer",
    ]),
    search: [
      { text: "focus timer app", strategy: "search", priority: 7200 },
      { text: "focus music", strategy: "search", priority: 6100 },
      { text: "focus mode", strategy: "search", priority: 5400 },
    ],
    competitorSearch: [
      {
        text: "focus timer for adhd",
        strategy: "competitorSearch",
        seed: "focus timer",
        usedByCount: 1,
      },
      {
        text: "deep work timer app",
        strategy: "competitorSearch",
        seed: "deep work",
        usedByCount: 2,
      },
    ],
  },
  "app-2": {
    metadata: listingSuggestions(["habit streaks", "daily habits"]),
  },
  "app-new": {
    metadata: listingSuggestions([
      "imported timer",
      "work sessions",
      "break reminder",
      "task focus",
      "time blocking",
      "study clock",
      "focus sounds",
      "productivity timer",
      "deep work",
      "flow state",
    ]),
  },
};

export const DATASETS: Record<string, AppDataset> = {
  "app-1": {
    detail: APP_1_DETAIL,
    summary: APP_1_SUMMARY,
    keywords: APP_1_KEYWORDS,
    rankings: APP_1_RANKINGS,
    serpMovers: APP_1_SERP_MOVERS,
    visibility: APP_1_VISIBILITY,
    rankDistributionHistory: APP_1_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: APP_1_CATEGORY_RANKS,
    competitors: APP_1_COMPETITORS,
    reviews: APP_1_REVIEWS,
    reviewThemes: APP_1_REVIEW_THEMES,
    ratingsHistory: APP_1_RATINGS_HISTORY,
    ratingsHistogram: APP_1_RATINGS_HISTOGRAM,
    changes: APP_1_CHANGES,
    changeImpact: APP_1_CHANGE_IMPACT,
    discovery: APP_1_DISCOVERY,
    comparison: APP_1_COMPARISON,
  },
  "app-2": {
    detail: APP_2_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: [],
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(APP_2_DETAIL),
    discovery: EMPTY_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-long": {
    detail: APP_LONG_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: APP_LONG_KEYWORDS,
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: SPARSE_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: APP_LONG_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(APP_LONG_DETAIL),
    discovery: EMPTY_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-bulk": {
    detail: APP_BULK_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: APP_BULK_KEYWORDS,
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(APP_BULK_DETAIL),
    discovery: EMPTY_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-combos": {
    detail: APP_COMBOS_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: APP_COMBOS_KEYWORDS,
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(APP_COMBOS_DETAIL),
    discovery: EMPTY_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-unchecked": {
    detail: APP_UNCHECKED_DETAIL,
    summary: APP_UNCHECKED_SUMMARY,
    keywords: APP_UNCHECKED_KEYWORDS,
    rankings: APP_UNCHECKED_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(APP_UNCHECKED_DETAIL),
    discovery: EMPTY_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-1-de": {
    detail: APP_1_DE_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: [],
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(APP_1_DE_DETAIL),
    discovery: APP_1_DE_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-gp": {
    detail: APP_GP_DETAIL,
    summary: APP_GP_SUMMARY,
    keywords: APP_GP_KEYWORDS,
    rankings: APP_GP_RANKINGS,
    serpMovers: APP_GP_SERP_MOVERS,
    visibility: APP_GP_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: APP_GP_COMPETITORS,
    reviews: APP_GP_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(APP_GP_DETAIL),
    discovery: APP_GP_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-new": {
    detail: IMPORTED_APP_DETAIL,
    summary: APP_2_SUMMARY,
    keywords: APP_NEW_KEYWORDS,
    rankings: EMPTY_RANKINGS,
    serpMovers: EMPTY_SERP_MOVERS,
    visibility: EMPTY_VISIBILITY,
    rankDistributionHistory: EMPTY_RANK_DISTRIBUTION_HISTORY,
    categoryRanks: EMPTY_CATEGORY_RANKS,
    competitors: [],
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    ratingsHistogram: EMPTY_RATINGS_HISTOGRAM,
    changes: EMPTY_CHANGES,
    changeImpact: emptyChangeImpact(IMPORTED_APP_DETAIL),
    discovery: EMPTY_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
};

function categorySeries(
  collection: CategoryCollection,
  genre: string,
  positions: Array<number | null>,
  lastCapturedDaysAgo = 0,
  depth = 100,
): CategoryRankSeriesItem {
  return {
    collection,
    genre,
    genreName: genre === OVERALL_GENRE ? "Overall" : "Games",
    current: positions.at(-1) ?? null,
    depth,
    points: positions.map((position, index) => ({
      date: utcDaysAgo(lastCapturedDaysAgo + positions.length - 1 - index),
      position,
    })),
  };
}

function categoryDataset(
  id: string,
  name: string,
  price: number,
  series: CategoryRankSeriesItem[],
): AppDataset {
  const detail = DATASETS["app-1"].detail;
  return {
    ...DATASETS["app-1"],
    detail: {
      ...detail,
      id,
      name,
      latestSnapshot: detail.latestSnapshot && {
        ...detail.latestSnapshot,
        title: name,
        price,
      },
    },
    categoryRanks: { series },
  };
}

export const APP_PAID_TOP_CHART_ID = "app-paid-top-chart";
export const APP_PAID_GROSSING_ONLY_ID = "app-paid-grossing-only";
export const APP_PAID_UNRANKED_ID = "app-paid-unranked";
export const APP_REPRICED_FREE_ID = "app-repriced-free";
export const APP_REPRICED_PAID_ID = "app-repriced-paid";
export const APP_FREE_AGAIN_ID = "app-free-again";
export const APP_LOCALES_ID = "app-locales";
export const APP_SUGGESTED_LOCALES_ID = "app-suggested-locales";
export const APP_RIVAL_ID = "app-rival";

export interface LocalizationSeed {
  markets?: string[];
  shipped?: {
    localization: AppStoreLocalization;
    origin: "manual" | "detected";
  }[];
  fields?: Partial<Record<AppStoreLocalization, string[]>>;
  tracked?: Record<string, string[]>;
}

function localesDataset(id: string, name: string): AppDataset {
  const base = DATASETS["app-2"];
  const detail = { ...base.detail, id, name };
  return {
    ...base,
    detail,
    keywords: [],
    competitors: [],
    changeImpact: emptyChangeImpact(detail),
  };
}

DATASETS[APP_LOCALES_ID] = localesDataset(APP_LOCALES_ID, "Locale Lab");
DATASETS[APP_SUGGESTED_LOCALES_ID] = localesDataset(
  APP_SUGGESTED_LOCALES_ID,
  "Market Lab",
);
const rivalDataset = localesDataset(APP_RIVAL_ID, "Rival Lab");
DATASETS[APP_RIVAL_ID] = {
  ...rivalDataset,
  detail: { ...rivalDataset.detail, isCompetitor: true },
};

DATASETS[APP_PAID_TOP_CHART_ID] = categoryDataset(
  APP_PAID_TOP_CHART_ID,
  "Heads Up",
  1.99,
  [
    categorySeries("grossing", "6014", [null, null, null]),
    categorySeries("grossing", OVERALL_GENRE, [null, null, null]),
    categorySeries("paid", "6014", [3, 3, 2]),
    categorySeries("paid", OVERALL_GENRE, [9, 8, 7]),
  ],
);

DATASETS[APP_PAID_GROSSING_ONLY_ID] = categoryDataset(
  APP_PAID_GROSSING_ONLY_ID,
  "Fresh Paid",
  2.99,
  [
    categorySeries("grossing", "6014", [34, 33, 31]),
    categorySeries("grossing", OVERALL_GENRE, [140, 138, 136]),
  ],
);

DATASETS[APP_PAID_UNRANKED_ID] = categoryDataset(
  APP_PAID_UNRANKED_ID,
  "Quiet Paid",
  0.99,
  [
    categorySeries("grossing", "6014", [null, null, null]),
    categorySeries("paid", "6014", [null, null, null]),
  ],
);

DATASETS[APP_REPRICED_FREE_ID] = categoryDataset(
  APP_REPRICED_FREE_ID,
  "Went Free",
  0,
  [
    categorySeries("free", "6014", [12, 9, 8]),
    categorySeries("grossing", "6014", [null, null, null]),
    categorySeries("paid", "6014", [5, 4, 4], 20),
  ],
);

DATASETS[APP_REPRICED_PAID_ID] = categoryDataset(
  APP_REPRICED_PAID_ID,
  "Went Paid",
  4.99,
  [
    categorySeries("free", "6014", [30, 28, 25], 20),
    categorySeries("grossing", "6014", [null, null, null]),
    categorySeries("paid", "6014", [6, 6, 6]),
  ],
);

DATASETS[APP_FREE_AGAIN_ID] = categoryDataset(
  APP_FREE_AGAIN_ID,
  "Free Again",
  0,
  [
    categorySeries("free", "6014", [14, 13, 12], 53),
    categorySeries("grossing", "6014", [null, null, null]),
    categorySeries("paid", "6014", [3, 2, 2]),
  ],
);

export const APP_EUR_ID = "app-price-eur";
export const APP_JPY_ID = "app-price-jpy";
export const APP_UNKNOWN_CURRENCY_ID = "app-price-unknown";
export const APP_HUF_ID = "app-price-huf";

export const PRICED_REFRESHES = new Map<
  string,
  { price: string; currency: string | null }
>([
  [APP_EUR_ID, { price: "4.99", currency: "EUR" }],
  [APP_JPY_ID, { price: "500", currency: "JPY" }],
  [APP_UNKNOWN_CURRENCY_ID, { price: "3.5", currency: null }],
]);

const POLISH_RIVAL: CompetitorItem = {
  id: "comp-pl",
  store: "APP_STORE",
  name: "Rival Polska",
  iconUrl: null,
  latestSnapshot: {
    id: "snap-comp-pl",
    title: "Rival Polska",
    subtitle: null,
    summary: null,
    ratingAvg: 4.1,
    ratingCount: 900,
    installs: null,
    price: 9.99,
    currency: "PLN",
    version: "1.0.0",
    capturedAt: utcTimestampDaysAgo(0),
  },
};

function pricedDataset(
  id: string,
  name: string,
  price: number,
  currency: string | null,
  events: ChangeTimeline["events"],
): AppDataset {
  const base = DATASETS["app-1"];
  const detail: AppDetail = {
    ...base.detail,
    id,
    name,
    competitors: [POLISH_RIVAL],
    latestSnapshot: base.detail.latestSnapshot && {
      ...base.detail.latestSnapshot,
      id: `snap-${id}`,
      title: name,
      price,
      currency,
    },
  };
  return {
    ...base,
    detail,
    competitors: [POLISH_RIVAL],
    changes: { events },
    changeImpact: emptyChangeImpact(detail),
  };
}

const priceEvent = (
  id: string,
  appId: string,
  appName: string,
  after: string,
  currency: string | null | undefined,
  daysAgo: number,
): ChangeTimeline["events"][number] => ({
  id,
  appId,
  appName,
  isCompetitor: appId === POLISH_RIVAL.id,
  field: "price",
  before: "0",
  after,
  ...(currency === undefined ? {} : { currency }),
  capturedAt: utcTimestampDaysAgo(daysAgo),
});

DATASETS[APP_EUR_ID] = pricedDataset(
  APP_EUR_ID,
  "Euro Priced",
  4.99,
  "EUR",
  [],
);

DATASETS[APP_JPY_ID] = pricedDataset(APP_JPY_ID, "Yen Priced", 500, "JPY", [
  priceEvent("chg-jpy", APP_JPY_ID, "Yen Priced", "500", "JPY", 2),
  priceEvent("chg-pln", POLISH_RIVAL.id, "Rival Polska", "9.99", "PLN", 3),
  priceEvent("chg-old", POLISH_RIVAL.id, "Rival Polska", "2.5", undefined, 4),
]);

DATASETS[APP_UNKNOWN_CURRENCY_ID] = pricedDataset(
  APP_UNKNOWN_CURRENCY_ID,
  "Unknown Currency",
  3.5,
  null,
  [],
);

export const APP_TAGS_ID = "app-tags";

DATASETS[APP_TAGS_ID] = {
  ...DATASETS["app-1"],
  detail: { ...APP_1_DETAIL, id: APP_TAGS_ID, name: "Tag Lab" },
  keywords: APP_1_KEYWORDS.slice(0, 3).map((keyword) => ({
    ...keyword,
    tags: [],
    note: null,
  })),
};

export const APP_REPLIES_ID = "app-replies";

DATASETS[APP_REPLIES_ID] = {
  ...DATASETS["app-1"],
  detail: { ...APP_1_DETAIL, id: APP_REPLIES_ID, name: "Reply Lab" },
  reviews: {
    ...APP_1_REVIEWS,
    reviews: APP_1_REVIEWS.reviews.map((review) => ({
      ...structuredClone(review),
      id: review.id.replace("rev-", "rep-"),
    })),
  },
};

export const APP_IMPORT_ID = "app-import";

DATASETS[APP_IMPORT_ID] = {
  ...DATASETS["app-1"],
  detail: { ...APP_1_DETAIL, id: APP_IMPORT_ID, name: "Import Lab" },
  keywords: structuredClone(APP_1_KEYWORDS),
};

DATASETS[APP_IPAD_ONLY_DETAIL.id] = {
  ...DATASETS["app-unchecked"],
  detail: APP_IPAD_ONLY_DETAIL,
  changeImpact: emptyChangeImpact(APP_IPAD_ONLY_DETAIL),
};

export const INITIAL_APPS: AppListItem[] = [APP_1, APP_2, APP_LONG, APP_GP];

export const PORTFOLIO: PortfolioSummary = {
  apps: [
    {
      id: "app-1",
      store: "APP_STORE",
      storeAppId: "123456789",
      country: "us",
      name: "Focus Timer",
      iconUrl: null,
      groupId: null,
      groupName: null,
      visibility: { current: 62.4, delta7d: 5 },
      sparkline: APP_1_VISIBILITY.points,
      trackedKeywords: 5,
      competitors: 1,
      lastCapturedAt: utcTimestampDaysAgo(0),
    },
    {
      id: "app-2",
      store: "APP_STORE",
      storeAppId: "987654321",
      country: "us",
      name: "Habit Tracker",
      iconUrl: APP_2_ICON_URL,
      groupId: null,
      groupName: null,
      visibility: { current: 10, delta7d: null },
      sparkline: [],
      trackedKeywords: 0,
      competitors: 0,
      lastCapturedAt: utcTimestampDaysAgo(1),
    },
    {
      id: "app-1-de",
      store: "APP_STORE",
      storeAppId: "123456789",
      country: "de",
      name: "Focus Timer",
      iconUrl: null,
      groupId: null,
      groupName: null,
      visibility: { current: 31.5, delta7d: -2 },
      sparkline: [],
      trackedKeywords: 3,
      competitors: 0,
      lastCapturedAt: utcTimestampDaysAgo(0),
    },
    {
      id: "app-gp",
      store: "GOOGLE_PLAY",
      storeAppId: "com.bitwise.tomatoclock",
      country: "de",
      name: "Tomato Clock",
      iconUrl: null,
      groupId: null,
      groupName: null,
      visibility: { current: 24.8, delta7d: 3 },
      sparkline: APP_GP_VISIBILITY.points,
      trackedKeywords: 3,
      competitors: 1,
      lastCapturedAt: utcTimestampDaysAgo(0),
    },
  ],
  groups: [],
  totals: { apps: 4, competitors: 2, trackedKeywords: 11, changes7d: 3 },
};

export const APP_1_KEYWORD_COUNTRIES: KeywordCountrySummary[] = [
  { country: "us", keywordCount: APP_1_KEYWORDS.length },
  { country: "pl", keywordCount: 0 },
  { country: "gb", keywordCount: 0 },
];

const suggestedMarket = (
  country: string,
  localization: AppStoreLocalization,
  role: MarketSuggestion["role"],
  listing = 2,
): MarketSuggestion => ({
  country,
  localization,
  language: localization.split("-")[0],
  role,
  tracked: false,
  dailyRequests: { listing, perKeyword: 1 },
});

export const MARKET_SUGGESTIONS: Record<string, MarketSuggestionsResult> = {
  "app-1": {
    home: "us",
    languages: ["en", "de", "fr", "ja", "pl"],
    suggestions: [
      suggestedMarket("at", "de", "default"),
      suggestedMarket("ch", "de", "default"),
      suggestedMarket("de", "de", "default"),
      suggestedMarket("fr", "fr", "default"),
      suggestedMarket("jp", "ja", "default"),
      suggestedMarket("ca", "fr-CA", "additional"),
      suggestedMarket("pl", "pl", "additional", 4),
    ],
  },
  "app-suggested-locales": {
    home: "us",
    languages: ["en", "fr", "pt"],
    suggestions: [
      suggestedMarket("fr", "fr", "default", 1),
      suggestedMarket("br", "pt-BR", "default", 1),
      suggestedMarket("ca", "fr-CA", "additional", 1),
    ],
  },
};

export const BUDGET: DailyBudget = {
  apps: 3,
  marketListings: 0,
  keywords: 12,
  categories: 4,
  reviews: 2,
  total: 21,
  capacityPerDay: 36000,
  utilization: 0.001,
  stores: [
    {
      store: "APP_STORE",
      apps: 3,
      marketListings: 0,
      keywords: 12,
      categories: 4,
      reviews: 2,
      total: 21,
      capacityPerDay: 21600,
      utilization: 0.001,
    },
    {
      store: "GOOGLE_PLAY",
      apps: 0,
      marketListings: 0,
      keywords: 0,
      categories: 0,
      reviews: 0,
      total: 0,
      capacityPerDay: 14400,
      utilization: 0,
    },
  ],
  quota: {
    plan: "indie",
    apps: { used: 3, limit: 5 },
    keywordMarkets: { used: 12, limit: 1000 },
    overLimitSince: null,
  },
  completion: {
    startsAt: "2026-07-31T03:00:00.000Z",
    completesAt: "2026-07-31T03:01:00.000Z",
    hours: 0.02,
  },
};

export const HOT_BUDGET: DailyBudget = {
  ...BUDGET,
  utilization: 0.92,
  stores: BUDGET.stores.map((store) => ({ ...store, utilization: 0.92 })),
};

export const MARKET_BUDGET: DailyBudget = { ...BUDGET, marketListings: 3 };

export const LAPSED_BUDGET: DailyBudget = {
  ...BUDGET,
  quota: {
    plan: "free",
    apps: { used: 7, limit: 0 },
    keywordMarkets: { used: 52, limit: 0 },
    overLimitSince: "2026-09-20T03:00:00.000Z",
  },
};

export const OVER_LIMIT_BUDGET: DailyBudget = {
  ...BUDGET,
  quota: {
    plan: "indie",
    apps: { used: 2, limit: 3 },
    keywordMarkets: { used: 240, limit: 200 },
    overLimitSince: "2026-09-30T03:00:00.000Z",
  },
};

export const RECENT_CHANGES: ChangeTimeline = {
  events: [
    {
      id: "chg-1",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "title",
      before: "Focus Timer",
      after: "Focus Timer Pro",
      capturedAt: utcTimestampDaysAgo(0),
    },
    {
      id: "chg-2",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "subtitle",
      before: "Deep work timer",
      after: "Deep focus timer",
      capturedAt: utcTimestampDaysAgo(2),
    },
    {
      id: "chg-3",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "version",
      before: "2.0.0",
      after: "2.1.0",
      capturedAt: utcTimestampDaysAgo(3),
    },
    {
      id: "chg-4",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "version",
      before: "2.1.0",
      after: "2.2.0",
      capturedAt: utcTimestampDaysAgo(4),
    },
    {
      id: "chg-5",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "version",
      before: "2.2.0",
      after: "2.3.0",
      capturedAt: utcTimestampDaysAgo(5),
    },
    {
      id: "chg-6",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "version",
      before: "2.3.0",
      after: "2.4.0",
      capturedAt: utcTimestampDaysAgo(6),
    },
    {
      id: "chg-7",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "version",
      before: "2.4.0",
      after: "2.5.0",
      capturedAt: utcTimestampDaysAgo(7),
    },
    {
      id: "chg-8",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "version",
      before: "2.5.0",
      after: "2.6.0",
      capturedAt: utcTimestampDaysAgo(8),
    },
    {
      id: "chg-9",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "version",
      before: "2.6.0",
      after: "2.7.0",
      capturedAt: utcTimestampDaysAgo(9),
    },
    {
      id: "chg-10",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "version",
      before: "2.7.0",
      after: "2.8.0",
      capturedAt: utcTimestampDaysAgo(10),
    },
    {
      id: "chg-11",
      appId: "comp-1",
      appName: "Rival Focus",
      isCompetitor: true,
      field: "whatsNew",
      before: "v2.7\n- Calmer sounds",
      after:
        "v2.8\n- New stickers\n- Type <Username> to mention\n- Faster sync &amp; backup",
      capturedAt: utcTimestampDaysAgo(11),
    },
  ],
};

export const WEBHOOKS: WebhookItem[] = [
  {
    id: "hook-1",
    url: "https://hooks.example.com/services/T0000000/B0000000/asobeast-alerts",
    events: ["metadata.changed", "rank.dropped", "review.negative"],
    active: true,
    hasSecret: true,
    createdAt: utcTimestampDaysAgo(5),
  },
];

export const EMAIL_ALERTS: EmailAlertItem[] = [
  {
    id: "email-1",
    email: "ops@example.com",
    events: ["metadata.changed", "rank.dropped"],
    active: true,
    confirmed: true,
    createdAt: utcTimestampDaysAgo(3),
  },
];

export const EMAIL_DELIVERIES: AlertDeliveryItem[] = [
  {
    id: "del-1",
    channel: "email",
    event: "rank.dropped",
    status: "failed",
    detail: "smtp timeout",
    attempt: 2,
    createdAt: utcTimestampDaysAgo(1),
  },
  {
    id: "del-2",
    channel: "email",
    event: "metadata.changed",
    status: "success",
    detail: null,
    attempt: 1,
    createdAt: utcTimestampDaysAgo(2),
  },
];

export const PENDING_PORTFOLIO_APP: PortfolioSummary["apps"][number] = {
  id: "app-pending",
  store: "GOOGLE_PLAY",
  storeAppId: "com.example.pending",
  country: "us",
  name: "Pending App",
  iconUrl: null,
  groupId: null,
  groupName: null,
  visibility: { current: 0, delta7d: null },
  sparkline: [],
  trackedKeywords: 0,
  competitors: 0,
  lastCapturedAt: null,
};

const MANY_APP_NAMES = [
  ["Sleep Sounds", "APP_STORE", "gb"],
  ["Water Reminder", "GOOGLE_PLAY", "fr"],
  ["Budget Planner", "APP_STORE", "jp"],
  ["Step Counter", "GOOGLE_PLAY", "br"],
  ["Recipe Keeper", "APP_STORE", "in"],
  [
    "Language Cards: Learn Vocabulary With Spaced Repetition",
    "GOOGLE_PLAY",
    "mx",
  ],
] as const;

export const MANY_PORTFOLIO_APPS: PortfolioSummary["apps"] = MANY_APP_NAMES.map(
  ([name, store, country], index) => ({
    id: `app-many-${index + 1}`,
    store,
    storeAppId: `many.${index + 1}`,
    country,
    name,
    iconUrl: null,
    groupId: null,
    groupName: null,
    visibility: { current: 8 - index, delta7d: null },
    sparkline: [],
    trackedKeywords: 2,
    competitors: 0,
    lastCapturedAt: utcTimestampDaysAgo(0),
  }),
);

export const IMPORTED_PORTFOLIO_APP: PortfolioSummary["apps"][number] = {
  id: "app-new",
  store: "APP_STORE",
  storeAppId: "999999",
  country: "us",
  name: "Imported App",
  iconUrl: null,
  groupId: null,
  groupName: null,
  visibility: { current: 0, delta7d: null },
  sparkline: [],
  trackedKeywords: 0,
  competitors: 0,
  lastCapturedAt: null,
};

const ERROR_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  500: "Internal Server Error",
  501: "Not Implemented",
};

const ERROR_MESSAGES: Record<number, string> = {
  401: "Not authenticated",
  404: "The requested resource was not found.",
  501: "Google Play is not supported yet.",
};

const TRIAL_READS_PER_MINUTE = PLAN_LIMITS.trial.apiRequestsPerMinute as number;

export const RATE_LIMIT_RESET_SECONDS = 4;

export function rateLimitedEnvelope(path: string): ApiErrorEnvelope {
  return {
    statusCode: 429,
    error: "Too Many Requests",
    message: `Rate limit reached: the trial plan allows ${TRIAL_READS_PER_MINUTE} read requests per minute. Wait ${RATE_LIMIT_RESET_SECONDS} seconds before the next one, because retrying before then will fail.`,
    path,
    timestamp: new Date().toISOString(),
    rateLimit: {
      window: "minute",
      rateClass: "read",
      plan: "trial",
      limit: TRIAL_READS_PER_MINUTE,
      resetSeconds: RATE_LIMIT_RESET_SECONDS,
      upgradeTo: "indie",
    },
    retryAfterSeconds: RATE_LIMIT_RESET_SECONDS,
  };
}

export function errorEnvelope(
  statusCode: number,
  path: string,
  message?: string,
): ApiErrorEnvelope {
  return {
    statusCode,
    error: ERROR_TITLES[statusCode] ?? "Error",
    message:
      message ??
      ERROR_MESSAGES[statusCode] ??
      "The server encountered an unexpected error.",
    path,
    timestamp: new Date().toISOString(),
  };
}

const ACTION_BASE = {
  formulaVersion: "actions-v1",
  degraded: false,
  firstSeenAt: "2026-07-20T03:00:00.000Z",
  lastSeenAt: "2026-07-30T03:00:00.000Z",
  resolvedAt: null,
  snoozedUntil: null,
  closedAt: null,
  verifiedAt: null,
  reopenCount: 0,
  note: null,
  ai: { explanation: null, model: null, generatedAt: null },
} as const;

const APP_SCOPE = {
  appId: "app-1",
  appName: "Focus Timer",
  store: "APP_STORE",
  country: "us",
} as const;

export const ACTIONS: ActionItem[] = [
  {
    ...ACTION_BASE,
    id: "act-uncovered",
    rule: "keyword.add_uncovered",
    category: "metadata",
    status: "OPEN",
    priority: "critical",
    impact: 88,
    scope: { ...APP_SCOPE, keywordId: "kw-1", keywordText: "habit tracker" },
    evidence: {
      rule: "keyword.add_uncovered",
      opportunity: 66.5,
      traffic: 6.2,
      difficulty: 4.1,
      volume: 62,
      relevance: 80,
      latestPosition: null,
      latestDepth: null,
      indexedFields: ["title", "subtitle", "keywordField"],
      uncoveredFields: ["title", "subtitle", "keywordField"],
      keywordFieldCharsFree: 18,
      scoreProvenance: null,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-defend",
    rule: "keyword.defend",
    category: "competition",
    status: "OPEN",
    priority: "high",
    impact: 71,
    scope: { ...APP_SCOPE, keywordId: "kw-2", keywordText: "streak counter" },
    evidence: {
      rule: "keyword.defend",
      yourPosition: 6,
      previousPosition: 4,
      windowDays: 7,
      observedDays: 6,
      volatility: 12,
      entrants: [
        {
          storeAppId: "9001",
          title: "Rival Habits",
          position: 3,
          appId: null,
          isCompetitor: false,
        },
        {
          storeAppId: "9002",
          title: "Streaks Pro",
          position: 5,
          appId: "comp-1",
          isCompetitor: true,
        },
      ],
      entrantsAtOrAbove: 2,
      volume: 55,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-prune",
    rule: "keyword.prune",
    category: "hygiene",
    status: "OPEN",
    priority: "medium",
    impact: 42,
    scope: { ...APP_SCOPE, keywordId: "kw-3", keywordText: "obscure phrase" },
    evidence: {
      rule: "keyword.prune",
      observedDays: 40,
      checkedDays: 40,
      rankedDays: 0,
      bestPosition: null,
      volume: 3,
      traffic: 0.3,
      relevance: 20,
      dailyRequestsSaved: 1,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-drop",
    rule: "rank.investigate_drop",
    category: "regression",
    status: "OPEN",
    priority: "high",
    impact: 64,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "rank.investigate_drop",
      changedAt: "2026-07-24",
      fields: ["title"],
      visibilityBefore: 42.1,
      visibilityAfter: 31.4,
      visibilityDelta: 10.7,
      windowDays: 14,
      trackedKeywords: 40,
      droppedKeywords: [
        { keywordId: "kw-1", text: "habit tracker", from: 4, to: 19 },
      ],
      meanVolatility: 12,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-volatile",
    rule: "serp.hold_volatile",
    category: "hygiene",
    status: "OPEN",
    priority: "medium",
    impact: 38,
    scope: { ...APP_SCOPE, keywordId: "kw-2", keywordText: "streak counter" },
    evidence: {
      rule: "serp.hold_volatile",
      volatility: 61,
      windowDays: 8,
      observedDays: 7,
      yourPosition: 12,
      dampenedRules: ["keyword.defend"],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-audit",
    rule: "audit.fix_factor",
    category: "conversion",
    status: "OPEN",
    priority: "high",
    impact: 61,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "audit.fix_factor",
      factorId: "screenshots",
      factorLabel: "Screenshots",
      score: 3,
      weight: 15,
      overall: 61,
      coveredWeight: 85,
      totalWeight: 100,
      auditDate: "2026-07-29",
      failingChecks: [
        {
          id: "screenshots-count",
          label: "Screenshot count",
          status: "fail",
          score: 2,
        },
      ],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-reviews",
    rule: "reviews.investigate_theme",
    category: "reputation",
    status: "OPEN",
    priority: "medium",
    impact: 45,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "reviews.investigate_theme",
      theme: "crashes on launch",
      version: "4.2.0",
      previousVersion: "4.1.0",
      mentions: 9,
      previousMentions: 1,
      negativeReviews: 22,
      totalReviews: 61,
      ratingAvgDelta: -0.4,
      sampleReviewIds: ["rev-1", "rev-2"],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-market",
    rule: "market.improve_country",
    category: "markets",
    status: "OPEN",
    priority: "low",
    impact: 28,
    scope: { ...APP_SCOPE, country: "de", keywordId: null, keywordText: null },
    evidence: {
      rule: "market.improve_country",
      country: "de",
      homeCountry: "us",
      marketVisibility: 18.2,
      homeVisibility: 44.7,
      gap: 26.5,
      trackedKeywords: 12,
      rankedKeywords: 4,
      observedDays: 12,
      windowDays: 14,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-push",
    rule: "keyword.push_to_top10",
    category: "metadata",
    status: "OPEN",
    priority: "medium",
    impact: 48,
    scope: {
      ...APP_SCOPE,
      keywordId: "kw-10",
      keywordText:
        "pomodoro timer for deep focus sessions and study breaks with ambient sounds",
    },
    evidence: {
      rule: "keyword.push_to_top10",
      latestPosition: 12,
      bestPosition: 11,
      daysInBand: 6,
      windowDays: 7,
      volume: 54,
      relevance: 80,
      opportunity: 41.5,
      coveredFields: ["keywordField"],
      strongFields: ["title", "subtitle"],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-lint",
    rule: "metadata.fix_lint",
    category: "metadata",
    status: "OPEN",
    priority: "medium",
    impact: 50,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "metadata.fix_lint",
      field: "title",
      chars: 34,
      limit: 30,
      issues: [
        {
          rule: "over-limit",
          message: "Exceeds the 30 character limit (34).",
          offendingText: null,
        },
      ],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-slide",
    rule: "rank.investigate_unexplained_drop",
    category: "regression",
    status: "OPEN",
    priority: "medium",
    impact: 47,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "rank.investigate_unexplained_drop",
      country: "us",
      visibilityBefore: 40,
      visibilityAfter: 32.5,
      visibilityDelta: 7.5,
      windowDays: 14,
      trackedKeywords: 12,
      droppedKeywords: [
        { keywordId: "kw-2", text: "streak counter", from: 8, to: 17 },
      ],
      meanVolatility: 18,
      lastOwnChangeAt: null,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-overtake",
    rule: "competitor.investigate_overtake",
    category: "competition",
    status: "OPEN",
    priority: "high",
    impact: 63,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "competitor.investigate_overtake",
      competitorAppId: "comp-1",
      competitorName: "Tomato Focus",
      changedAt: "2026-07-24",
      fields: ["title"],
      newTitle: "Tomato Focus: Habit Tracker",
      newSubtitle: null,
      keywords: [
        {
          keywordId: "kw-1",
          text: "habit tracker",
          yourBefore: 6,
          yourAfter: 9,
          theirBefore: 14,
          theirAfter: 4,
          volume: 62,
          mentioned: true,
        },
        {
          keywordId: "kw-2",
          text: "streak counter",
          yourBefore: 8,
          yourAfter: 11,
          theirBefore: 12,
          theirAfter: 7,
          volume: 40,
          mentioned: false,
        },
      ],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-decline",
    rule: "reviews.investigate_rating_decline",
    category: "reputation",
    status: "OPEN",
    priority: "medium",
    impact: 44,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "reviews.investigate_rating_decline",
      recentAverage: 3.5,
      baselineAverage: 4.5,
      drop: 1,
      recentReviews: 8,
      baselineReviews: 6,
      recentDays: 14,
      baselineDays: 21,
      latestVersion: "4.2.0",
      negativeShare: 0.25,
      sampleReviewIds: ["rev-1", "rev-2"],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-stale",
    rule: "listing.ship_update",
    category: "conversion",
    status: "OPEN",
    priority: "medium",
    impact: 41,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "listing.ship_update",
      storeUpdatedAt: "2026-03-10T00:00:00.000Z",
      daysSinceUpdate: 142,
      version: "3.1.0",
      competitorMedianDays: 25,
      competitorsCompared: 3,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-snoozed",
    rule: "keyword.defend",
    category: "competition",
    status: "SNOOZED",
    priority: "high",
    impact: 60,
    snoozedUntil: "2026-08-15T00:00:00.000Z",
    scope: { ...APP_SCOPE, keywordId: "kw-2", keywordText: "streak counter" },
    evidence: {
      rule: "keyword.defend",
      yourPosition: 9,
      previousPosition: 7,
      windowDays: 7,
      observedDays: 5,
      volatility: 20,
      entrants: [],
      entrantsAtOrAbove: 0,
      volume: 40,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-reopened",
    rule: "audit.fix_factor",
    category: "conversion",
    status: "OPEN",
    priority: "medium",
    impact: 40,
    reopenCount: 2,
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "audit.fix_factor",
      factorId: "ratings",
      factorLabel: "Ratings & reviews",
      score: 4,
      weight: 15,
      overall: 58,
      coveredWeight: 70,
      totalWeight: 100,
      auditDate: "2026-07-29",
      failingChecks: [],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-degraded",
    rule: "keyword.add_uncovered",
    category: "metadata",
    status: "OPEN",
    priority: "low",
    impact: 20,
    degraded: true,
    evidence: null,
    scope: { ...APP_SCOPE, keywordId: "kw-9", keywordText: "stale phrase" },
  },
  {
    ...ACTION_BASE,
    id: "act-dismissed",
    rule: "keyword.prune",
    category: "hygiene",
    status: "DISMISSED",
    priority: "low",
    impact: 15,
    closedAt: "2026-07-28T00:00:00.000Z",
    scope: { ...APP_SCOPE, keywordId: "kw-4", keywordText: "retired phrase" },
    evidence: {
      rule: "keyword.prune",
      observedDays: 35,
      checkedDays: 35,
      rankedDays: 1,
      bestPosition: 180,
      volume: 2,
      traffic: 0.2,
      relevance: 15,
      dailyRequestsSaved: 1,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-reply",
    rule: "reviews.reply_negative",
    category: "reputation",
    status: "OPEN",
    priority: "medium",
    impact: 43,
    scope: {
      appId: "app-gp",
      appName: "Tomato Clock",
      store: "GOOGLE_PLAY",
      country: "de",
      keywordId: null,
      keywordText: null,
    },
    evidence: {
      rule: "reviews.reply_negative",
      unanswered: 3,
      checked: 4,
      negative: 4,
      windowDays: 14,
      oldestUnansweredAt: "2026-07-21T08:00:00.000Z",
      replyRate: 0.25,
      sampleReviewIds: ["rev-gp-1", "rev-gp-2", "rev-gp-3"],
    },
  },
  {
    ...ACTION_BASE,
    id: "act-gp-defend",
    rule: "keyword.defend",
    category: "competition",
    status: "OPEN",
    priority: "high",
    impact: 62,
    scope: {
      appId: "app-gp",
      appName: "Tomato Clock",
      store: "GOOGLE_PLAY",
      country: "de",
      keywordId: "kw-gp-1",
      keywordText: "tomato timer",
    },
    evidence: {
      rule: "keyword.defend",
      yourPosition: 5,
      previousPosition: 3,
      windowDays: 7,
      observedDays: 7,
      volatility: 9,
      entrants: [
        {
          storeAppId: "com.rival.focus",
          title: "Focus Rival",
          position: 2,
          appId: null,
          isCompetitor: false,
        },
        {
          storeAppId: "com.pomo.pro",
          title: "Pomo Pro",
          position: 4,
          appId: null,
          isCompetitor: false,
        },
      ],
      entrantsAtOrAbove: 2,
      volume: 48,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-done-confirmed",
    rule: "keyword.add_uncovered",
    category: "metadata",
    status: "DONE",
    priority: "high",
    impact: 66,
    firstSeenAt: "2026-07-08T03:00:00.000Z",
    lastSeenAt: "2026-07-20T03:00:00.000Z",
    closedAt: "2026-07-20T09:00:00.000Z",
    verifiedAt: "2026-07-21T03:00:00.000Z",
    scope: { ...APP_SCOPE, keywordId: "kw-5", keywordText: "focus music" },
    evidence: {
      rule: "keyword.add_uncovered",
      opportunity: 48.2,
      traffic: 5.1,
      difficulty: 3.8,
      volume: 51,
      relevance: 75,
      latestPosition: 16,
      indexedFields: ["title", "subtitle", "keywordField"],
      uncoveredFields: ["subtitle", "keywordField"],
      keywordFieldCharsFree: 12,
      scoreProvenance: null,
    },
  },
  {
    ...ACTION_BASE,
    id: "act-done-verifying",
    rule: "audit.fix_factor",
    category: "conversion",
    status: "DONE",
    priority: "medium",
    impact: 52,
    lastSeenAt: "2026-07-28T03:00:00.000Z",
    closedAt: "2026-07-29T08:00:00.000Z",
    scope: { ...APP_SCOPE, keywordId: null, keywordText: null },
    evidence: {
      rule: "audit.fix_factor",
      factorId: "icon",
      factorLabel: "Icon",
      score: 4,
      weight: 10,
      overall: 61,
      coveredWeight: 85,
      totalWeight: 100,
      auditDate: "2026-07-28",
      failingChecks: [
        {
          id: "icon-contrast",
          label: "Icon contrast",
          status: "warn",
          score: 5,
        },
      ],
    },
  },
];

export const ACTION_SUMMARY: ActionSummary = summarizeActions(ACTIONS, {
  generatedAt: "2026-07-30T03:00:00.000Z",
  suppressedByCap: 3,
});

export const METADATA_AUDIT: MetadataAuditResult = {
  appId: "app-1",
  store: "APP_STORE",
  fields: [
    {
      field: "title",
      value: "Focus Timer",
      chars: 11,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: "subtitle",
      value: "Pomodoro sessions that stick",
      chars: 28,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: "keywordField",
      value: "study timer,deep work",
      chars: 21,
      limit: 100,
      indexed: true,
      issues: [],
    },
  ],
  coverage: [
    {
      keywordId: "kw-1",
      text: "focus timer",
      bucket: "primary",
      fields: [
        { field: "title", covered: true },
        { field: "subtitle", covered: false },
        { field: "keywordField", covered: true },
      ],
      uncovered: false,
      screenshotText: { covered: true, positions: [1] },
    },
    {
      keywordId: "kw-2",
      text: "pomodoro",
      bucket: "secondary",
      fields: [
        { field: "title", covered: false },
        { field: "subtitle", covered: true },
        { field: "keywordField", covered: false },
      ],
      uncovered: false,
      screenshotText: { covered: false, positions: [] },
    },
    {
      keywordId: "kw-3",
      text: "productivity app",
      bucket: "longtail",
      fields: [
        { field: "title", covered: false },
        { field: "subtitle", covered: false },
        { field: "keywordField", covered: false },
      ],
      uncovered: true,
      screenshotText: { covered: true, positions: [2] },
      country: "de",
      listingCountry: "us",
    },
  ],
  keywordFieldSuggestion: null,
  screenshotText: { status: "ready", read: 2, total: 4 },
};

export const UNREAD_MARKET_COOKIE = "e2e_unread_market_listing";

export const UNREAD_MARKET_COVERAGE_ROW: KeywordCoverageRow = {
  keywordId: "kw-fr-1",
  text: "minuteur focus",
  bucket: null,
  fields: [
    { field: "title", covered: false },
    { field: "subtitle", covered: true },
  ],
  uncovered: false,
  country: "fr",
  listingCountry: "fr",
};

export const APP_1_SCREENSHOTS: AppScreenshots = {
  appId: "app-1",
  store: "APP_STORE",
  snapshotId: "snap-app-1",
  capturedAt: utcTimestampDaysAgo(0),
  reading: "on",
  screenshots: [
    {
      position: 1,
      url: e2eScreenshotUrl(1),
      caption: "Focus timer for deep work",
      status: "read",
    },
    {
      position: 2,
      url: e2eScreenshotUrl(2),
      caption: "The productivity app that sticks",
      status: "read",
    },
    { position: 3, url: e2eScreenshotUrl(3), caption: null, status: "blank" },
    { position: 4, url: e2eScreenshotUrl(4), caption: null, status: "failed" },
  ],
};

export const APP_1_PL_SCREENSHOTS: AppScreenshots = {
  appId: "app-1",
  store: "APP_STORE",
  snapshotId: "snap-app-1-pl",
  capturedAt: utcTimestampDaysAgo(0),
  reading: "on",
  country: "pl",
  screenshots: [
    {
      position: 1,
      url: e2eScreenshotUrl(11),
      caption: "Minutnik do głębokiej pracy",
      status: "read",
    },
    { position: 2, url: e2eScreenshotUrl(13), caption: null, status: "blank" },
  ],
};

export const APP_1_PL_LOCALIZED_SCREENSHOTS: AppScreenshots = {
  ...APP_1_PL_SCREENSHOTS,
  snapshotId: "snap-app-1-pl-pl",
  localization: "pl",
  screenshots: [
    {
      position: 1,
      url: e2eScreenshotUrl(14),
      caption: "Skup się na jednym zadaniu",
      status: "read",
    },
  ],
};

export const SCREENSHOTS: Record<string, AppScreenshots> = {
  "app-1": APP_1_SCREENSHOTS,
};

export const emptyScreenshots = (
  appId: string,
  store: "APP_STORE" | "GOOGLE_PLAY",
): AppScreenshots => ({
  appId,
  store,
  snapshotId: null,
  capturedAt: null,
  reading: store === "GOOGLE_PLAY" ? "unsupported" : "on",
  screenshots: [],
});

export const APP_AR_ID = "app-ar";

export const APP_AR_DETAIL: AppDetail = {
  ...APP_GP_DETAIL,
  id: APP_AR_ID,
  storeAppId: "com.souq.shopper",
  country: "ae",
  name: "سوق: تسوق أونلاين",
};

const PLAY_FIELDS = ["title", "shortDescription", "description"] as const;

const playCoverageRow = (
  keywordId: string,
  text: string,
  bucket: KeywordCoverageRow["bucket"],
  covered: readonly boolean[],
): KeywordCoverageRow => ({
  keywordId,
  text,
  bucket,
  fields: PLAY_FIELDS.map((field, index) => ({
    field,
    covered: covered[index] ?? false,
  })),
  uncovered: !covered.some(Boolean),
});

const AR_DESCRIPTION =
  "تسوق الملابس والإلكترونيات ومنتجات المنزل من متجر واحد. شحن سريع إلى باب بيتك، ودفع آمن عند الاستلام، وعروض جديدة كل يوم. SHOP, SAVE & ENJOY مع تطبيق سوق.";

export const APP_AR_METADATA_AUDIT: MetadataAuditResult = {
  appId: APP_AR_ID,
  store: "GOOGLE_PLAY",
  fields: [
    {
      field: "title",
      value: "سوق: تسوق أونلاين",
      chars: 17,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: "shortDescription",
      value: "تسوق أحدث المنتجات بأفضل الأسعار مع توصيل سريع وإرجاع مجاني",
      chars: 59,
      limit: 80,
      indexed: true,
      issues: [],
    },
    {
      field: "description",
      value: AR_DESCRIPTION,
      chars: AR_DESCRIPTION.length,
      limit: 4000,
      indexed: true,
      issues: [],
    },
  ],
  coverage: [
    playCoverageRow("kw-ar-1", "تسوق اون لاين", "primary", [true, true, true]),
    playCoverageRow("kw-ar-2", "توصيل سريع", "primary", [false, true, true]),
    playCoverageRow("kw-ar-3", "ملابس رجالية", "secondary", [
      false,
      false,
      true,
    ]),
    playCoverageRow("kw-ar-4", "الكترونيات", "secondary", [false, false, true]),
    playCoverageRow("kw-ar-5", "دفع عند الاستلام", "longtail", [
      false,
      false,
      true,
    ]),
    playCoverageRow("kw-ar-6", "عروض الجمعة البيضاء", "longtail", [
      false,
      false,
      false,
    ]),
    playCoverageRow("kw-ar-7", "منتجات المنزل", "longtail", [
      false,
      false,
      true,
    ]),
    playCoverageRow("kw-ar-8", "شحن مجاني", "longtail", []),
  ],
  keywordFieldSuggestion: null,
};

DATASETS[APP_AR_ID] = {
  ...DATASETS["app-gp"],
  detail: APP_AR_DETAIL,
  changeImpact: emptyChangeImpact(APP_AR_DETAIL),
};

const PLAY_DESCRIPTION_ISSUES: LintIssue[] = [
  {
    rule: "no-cta",
    severity: "info",
    message: "No clear call to action detected.",
  },
  {
    rule: "no-social-proof",
    severity: "info",
    message: "No social proof (awards, press, user counts) detected.",
  },
  {
    rule: "no-formatting",
    severity: "info",
    message: "No line breaks or bullets; add formatting for readability.",
  },
];

export const APP_FR_ID = "app-fr";

export const APP_FR_DETAIL: AppDetail = {
  ...APP_GP_DETAIL,
  id: APP_FR_ID,
  storeAppId: "fr.vinted",
  country: "fr",
  name: "Vinted : vendre et acheter",
};

const FR_SHORT_DESCRIPTION =
  "Vendre tes vêtements de seconde main, acheter des vêtements sans frais";

const FR_DESCRIPTION =
  "Vinted est la première communauté de mode d'occasion. Vends les vêtements que tu ne portes plus, trouve des pièces uniques à petit prix et profite d'une livraison simple et sécurisée.";

export const APP_FR_METADATA_AUDIT: MetadataAuditResult = {
  appId: APP_FR_ID,
  store: "GOOGLE_PLAY",
  fields: [
    {
      field: "title",
      value: "Vinted : vendre et acheter",
      chars: 26,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: "shortDescription",
      value: FR_SHORT_DESCRIPTION,
      chars: FR_SHORT_DESCRIPTION.length,
      limit: 80,
      indexed: true,
      issues: [
        {
          rule: "repeats-title-word",
          severity: "warn",
          message: '"vendre" already appears in the title.',
          offendingText: "vendre",
        },
        {
          rule: "repeats-title-word",
          severity: "warn",
          message: '"acheter" already appears in the title.',
          offendingText: "acheter",
        },
        {
          rule: "keyword-stuffing",
          severity: "warn",
          message: '"vêtements" is repeated 2 times.',
          offendingText: "vêtements",
        },
      ],
    },
    {
      field: "description",
      value: FR_DESCRIPTION,
      chars: FR_DESCRIPTION.length,
      limit: 4000,
      indexed: true,
      issues: PLAY_DESCRIPTION_ISSUES,
    },
  ],
  coverage: [
    playCoverageRow("kw-fr-1", "vêtements de seconde main", "primary", [
      false,
      true,
      false,
    ]),
    playCoverageRow("kw-fr-2", "vendre et acheter", "primary", [
      true,
      false,
      false,
    ]),
    playCoverageRow("kw-fr-3", "mode d'occasion", "secondary", [
      false,
      false,
      true,
    ]),
  ],
  keywordFieldSuggestion: null,
};

DATASETS[APP_FR_ID] = {
  ...DATASETS["app-gp"],
  detail: APP_FR_DETAIL,
  changeImpact: emptyChangeImpact(APP_FR_DETAIL),
};

export const APP_HE_ID = "app-he";

export const APP_HE_DETAIL: AppDetail = {
  ...APP_GP_DETAIL,
  id: APP_HE_ID,
  storeAppId: "com.ideomobile.hapoalim",
  country: "il",
  name: "בנק הפועלים",
};

const HE_SHORT_DESCRIPTION =
  "בנק הפועלים בכף היד: חשבון, כרטיסי אשראי והעברות כספים בכל שעה ובכל מקום";

const HE_DESCRIPTION =
  "אפליקציית בנק הפועלים מאפשרת לנהל את החשבון בצורה פשוטה ומאובטחת: לבדוק יתרה, לשלם חשבונות, להעביר כסף ולקבל התראות בזמן אמת.";

export const APP_HE_METADATA_AUDIT: MetadataAuditResult = {
  appId: APP_HE_ID,
  store: "GOOGLE_PLAY",
  fields: [
    {
      field: "title",
      value: "בנק הפועלים",
      chars: 11,
      limit: 30,
      indexed: true,
      issues: [
        {
          rule: "under-utilized",
          severity: "warn",
          message: "Only 11 of 30 characters used.",
        },
      ],
    },
    {
      field: "shortDescription",
      value: HE_SHORT_DESCRIPTION,
      chars: HE_SHORT_DESCRIPTION.length,
      limit: 80,
      indexed: true,
      issues: [
        {
          rule: "repeats-title-word",
          severity: "warn",
          message: '"בנק" already appears in the title.',
          offendingText: "בנק",
        },
        {
          rule: "repeats-title-word",
          severity: "warn",
          message: '"הפועלים" already appears in the title.',
          offendingText: "הפועלים",
        },
      ],
    },
    {
      field: "description",
      value: HE_DESCRIPTION,
      chars: HE_DESCRIPTION.length,
      limit: 4000,
      indexed: true,
      issues: PLAY_DESCRIPTION_ISSUES,
    },
  ],
  coverage: [
    playCoverageRow("kw-he-1", "בנק הפועלים", "primary", [true, true, true]),
    playCoverageRow("kw-he-2", "כרטיסי אשראי", "secondary", [
      false,
      true,
      false,
    ]),
    playCoverageRow("kw-he-3", "העברת כספים", "longtail", [
      false,
      false,
      false,
    ]),
  ],
  keywordFieldSuggestion: null,
};

DATASETS[APP_HE_ID] = {
  ...DATASETS["app-gp"],
  detail: APP_HE_DETAIL,
  changeImpact: emptyChangeImpact(APP_HE_DETAIL),
};

export const METADATA_DRAFTS: MetadataDraft[] = [
  {
    field: "title",
    value: "Focus Timer: Pomodoro",
    chars: 21,
    limit: 30,
    issues: [],
    rationale: "Leads with the primary keyword.",
  },
  {
    field: "subtitle",
    value: "Deep work sessions",
    chars: 18,
    limit: 30,
    issues: [],
    rationale: "Adds a secondary keyword without a title word.",
  },
  {
    field: "keywordField",
    value: "study,habit,productivity",
    chars: 24,
    limit: 100,
    issues: [],
    rationale: "Covers uncovered terms.",
  },
];

const LONG_DESCRIPTION =
  "Deep Focus Timer turns every study session, deep work block and quiet reading hour into a calm, measurable routine that keeps you away from notifications, tabs and the endless scroll while the timer runs.";

const LONG_KEYWORD_FIELD =
  "focus,pomodoro,study,deepwork,productivity,concentration,habit,routine,planner,tracker,quiet,calm";

const withLongKeywordField = <
  T extends { field: string; value: string | null; chars: number },
>(
  row: T,
): T =>
  row.field === "keywordField"
    ? { ...row, value: LONG_KEYWORD_FIELD, chars: LONG_KEYWORD_FIELD.length }
    : row;

const COMPOUND_KEYWORD = "produktivitaetsmanagementsoftwareloesung";

const COMPOUND_KEYWORD_FIELD = `${COMPOUND_KEYWORD},${COMPOUND_KEYWORD}s`;

const withCompoundKeywordField = (
  row: MetadataAuditResult["fields"][number],
): MetadataAuditResult["fields"][number] =>
  row.field === "keywordField"
    ? {
        ...row,
        value: COMPOUND_KEYWORD_FIELD,
        chars: COMPOUND_KEYWORD_FIELD.length,
        issues: [
          {
            rule: "plural-form",
            severity: "warn",
            message: `Apple indexes both forms; "${COMPOUND_KEYWORD}s" duplicates "${COMPOUND_KEYWORD}".`,
            offendingText: `${COMPOUND_KEYWORD}s`,
          },
        ],
      }
    : row;

export const APP_LONG_METADATA_AUDIT: MetadataAuditResult = {
  ...METADATA_AUDIT,
  appId: "app-long",
  fields: [
    ...METADATA_AUDIT.fields.map(withCompoundKeywordField),
    {
      field: "description",
      value: LONG_DESCRIPTION,
      chars: LONG_DESCRIPTION.length,
      limit: 4000,
      indexed: false,
      issues: [
        {
          rule: "no-social-proof",
          severity: "info",
          message: "No social proof (awards, press, user counts) detected.",
        },
      ],
    },
  ],
};

export const METADATA_AUDIT_PL: MetadataAuditResult = {
  appId: "app-1",
  store: "APP_STORE",
  country: "pl",
  fields: [
    {
      field: "title",
      value: "Minutnik Skupienia",
      chars: 18,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: "subtitle",
      value: "Pomodoro i praca głęboka",
      chars: 24,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: "description",
      value: "Pracuj skupiony.",
      chars: 16,
      limit: 4000,
      indexed: false,
      issues: [],
    },
  ],
  coverage: [
    {
      keywordId: "kw-pl-1",
      text: "minutnik",
      bucket: null,
      fields: [
        { field: "title", covered: true },
        { field: "subtitle", covered: false },
      ],
      uncovered: false,
      country: "pl",
      listingCountry: "pl",
      screenshotText: { covered: true, positions: [1] },
    },
    {
      keywordId: "kw-pl-2",
      text: "skupienie",
      bucket: null,
      fields: [
        { field: "title", covered: true, localization: "pl" },
        { field: "subtitle", covered: false },
      ],
      uncovered: false,
      country: "pl",
      listingCountry: "pl",
      screenshotText: { covered: false, positions: [] },
    },
  ],
  keywordFieldSuggestion: null,
  screenshotText: { status: "ready", read: 1, total: 2 },
};

export const APP_1_PL_LOCALIZED_TITLE = "Skupienie: Minutnik Pracy";

export const APP_1_PL_KEYWORD_FIELD = "nawyki,cel";

export const DETECTABLE_LOCALIZATIONS: Record<string, AppStoreLocalization[]> =
  {
    [APP_LOCALES_ID]: ["fr", "pt-BR"],
  };

export const SEED_REFUSED_MESSAGE =
  "Refresh limit reached: the indie plan allows 20 requests per day. Try again in 3 hours.";

export const SEED_UNLISTED_MARKET = "jp";

export const SEED_TEXTS: Record<string, string[]> = {
  at: ["fokus timer", "gewohnheiten"],
};

export const DEFAULT_SEED_TEXTS = ["focus timer", "habits"];

export const DETECT_REFUSED_MESSAGE =
  "Refresh limit reached: the trial plan allows 5 requests per day. Try again in 3 hours.";

export const INITIAL_LOCALIZATION_SEEDS: Record<string, LocalizationSeed> = {
  "app-1": {
    shipped: [
      { localization: "en-GB", origin: "manual" },
      { localization: "pl", origin: "detected" },
      { localization: "es-MX", origin: "manual" },
    ],
    fields: {
      pl: APP_1_PL_KEYWORD_FIELD.split(","),
      "es-MX": ["temporizador", "enfoque"],
    },
  },
};

export const METADATA_AUDIT_PL_LOCALIZED: MetadataAuditResult = {
  ...METADATA_AUDIT_PL,
  localization: "pl",
  fields: METADATA_AUDIT_PL.fields.flatMap((field) => {
    if (field.field === "title") {
      return [
        {
          ...field,
          value: APP_1_PL_LOCALIZED_TITLE,
          chars: APP_1_PL_LOCALIZED_TITLE.length,
        },
      ];
    }
    if (field.field === "subtitle") {
      return [
        field,
        {
          field: "keywordField",
          value: APP_1_PL_KEYWORD_FIELD,
          chars: APP_1_PL_KEYWORD_FIELD.length,
          limit: 100,
          indexed: true,
          issues: [],
        },
      ];
    }
    return [field];
  }),
  coverage: METADATA_AUDIT_PL.coverage.map((row) =>
    row.keywordId === "kw-pl-2"
      ? {
          ...row,
          fields: [
            ...row.fields,
            { field: "keywordField", covered: true, localization: "pl" },
          ],
        }
      : row,
  ),
  keywordFieldSuggestion: {
    value: "nawyki,cel,plan",
    charactersUsed: 15,
    charactersLimit: 100,
    addedTerms: ["plan"],
    localization: "pl",
  },
};

export const METADATA_AUDITS: Record<string, MetadataAuditResult> = {
  "app-long": APP_LONG_METADATA_AUDIT,
  [APP_AR_ID]: APP_AR_METADATA_AUDIT,
  [APP_FR_ID]: APP_FR_METADATA_AUDIT,
  [APP_HE_ID]: APP_HE_METADATA_AUDIT,
};

METADATA_AUDITS[APP_LOCALES_ID] = METADATA_AUDIT;
METADATA_AUDITS[APP_SUGGESTED_LOCALES_ID] = METADATA_AUDIT;
METADATA_AUDITS[APP_RIVAL_ID] = METADATA_AUDIT;

export const APP_READS_ID = "app-reads";

type MarketWaste = Pick<MarketKeywordFields, "wastedWords" | "splitPhrases">;

const NO_WASTE: MarketWaste = { wastedWords: [], splitPhrases: [] };

const MARKET_WASTE: Record<string, MarketWaste> = {
  "app-1:us": {
    wastedWords: [{ word: "tracker", localizations: ["en-US", "es-MX"] }],
    splitPhrases: [
      {
        keywordId: "kw-habit-planner",
        phrase: "habit planner",
        parts: [
          { word: "habit", localizations: ["en-US"] },
          { word: "planner", localizations: ["es-MX"] },
        ],
      },
    ],
  },
  "app-1:mx": {
    wastedWords: [
      "alarm",
      "break",
      "calm",
      "focus",
      "goal",
      "timer",
      "zen",
    ].map((word) => ({
      word,
      localizations: ["es-MX", "en-GB"] satisfies AppStoreLocalization[],
    })),
    splitPhrases: [],
  },
};

export const marketWasteOf = (appId: string, country: string): MarketWaste =>
  MARKET_WASTE[`${appId}:${country}`] ?? NO_WASTE;

DATASETS[APP_READS_ID] = localesDataset(APP_READS_ID, "Read Lab");
METADATA_AUDITS[APP_READS_ID] = METADATA_AUDIT;

export const APP_LONG_METADATA_DRAFTS: MetadataDraft[] = METADATA_DRAFTS.map(
  (draft) => ({
    ...withLongKeywordField(draft),
    issues: [
      {
        rule: "under-utilized",
        severity: "warn",
        message: `Only ${draft.chars} of ${draft.limit} characters used.`,
      },
    ],
  }),
);

const auditCheck = (
  id: string,
  label: string,
  status: AppAuditResult["factors"][number]["checks"][number]["status"],
  score: number | null,
  detail: string,
  extra: Partial<AppAuditResult["factors"][number]["checks"][number]> = {},
): AppAuditResult["factors"][number]["checks"][number] => ({
  id,
  label,
  kind: "auto",
  status,
  score,
  detail,
  weight: 2,
  source: "store",
  unlock: null,
  ...extra,
});

const auditFactor = (
  id: string,
  label: string,
  weight: number,
  score: number | null,
  group: "discoverability" | "conversion",
  checks: AppAuditResult["factors"][number]["checks"],
  extra: Partial<AppAuditResult["factors"][number]> = {},
): AppAuditResult["factors"][number] => ({
  id,
  label,
  weight,
  score,
  needsInput: score === null,
  checks,
  group,
  confidence: score === null ? 0 : 1,
  availability: score === null ? "awaiting-input" : "measured",
  ...extra,
});

const recommendation = (
  factorId: string,
  checkId: string,
  label: string,
  lift: number,
  effort: "minutes" | "hours" | "weeks",
  target: AuditTarget,
): AuditRecommendation => ({
  factorId,
  checkId,
  label,
  detail: `Evidence for ${checkId}.`,
  fix: `Change ${checkId} the way the rubric describes.`,
  effort,
  impact: lift >= 3 ? "high" : lift >= 1 ? "medium" : "low",
  lift,
  target,
});

const APP_STORE_LIMITATIONS = [
  {
    id: "preview-video",
    label: "App previews",
    detail: "asobeast cannot see App Store previews.",
  },
  {
    id: "promotional-text",
    label: "Promotional text",
    detail: "Not in the data asobeast reads.",
  },
  {
    id: "review-replies",
    label: "Replies to reviews",
    detail: "The App Store review feed carries no developer replies.",
  },
];

const PLAY_LIMITATIONS = [
  {
    id: "video-content",
    label: "Promo video content",
    detail: "asobeast sees whether a video is linked, not what it shows.",
  },
  {
    id: "android-vitals",
    label: "Android vitals",
    detail: "Play Console only.",
  },
];

const CREATIVE_SCREENSHOTS = [
  "Guess any place",
  "Play against friends",
  "Learn every flag",
  "Track your streak",
  "Beat the clock",
  "Climb the board",
].map((captionText, index) => ({
  position: index + 1,
  url: `https://is1-ssl.mzstatic.com/image/s${index + 1}.png`,
  captionText,
  captionReadable: true,
  captionLanguage: "en",
  message: index === 0 ? ("benefit" as const) : ("feature" as const),
  keywordHits: index === 0 ? ["geo quiz"] : [],
}));

export const APP_AUDIT: AppAuditResult = {
  appId: "app-1",
  store: "APP_STORE",
  overall: 71.8,
  coveredWeight: 90,
  totalWeight: 110,
  rubricVersion: "v2",
  grade: "B",
  confidence: 0.82,
  potential: 86.4,
  groups: [
    {
      id: "discoverability",
      label: "Search visibility",
      score: 6.4,
      confidence: 0.9,
    },
    { id: "conversion", label: "Conversion", score: 7.7, confidence: 0.75 },
  ],
  factors: [
    auditFactor(
      "title",
      "Title",
      20,
      9.1,
      "discoverability",
      [
        auditCheck(
          "title-keyword",
          "Primary keyword in title",
          "pass",
          10,
          "The title contains \u201cgeo quiz\u201d, a primary keyword.",
          { source: "keywords" },
        ),
        auditCheck(
          "title-length",
          "Character usage",
          "warn",
          6.7,
          "19 of 30 characters used.",
        ),
      ],
      { confidence: 0.875, availability: "partial" },
    ),
    auditFactor("subtitle", "Subtitle", 15, 4.2, "discoverability", [
      auditCheck(
        "subtitle-length",
        "Character usage",
        "fail",
        0,
        "0 of 30 characters used.",
      ),
    ]),
    auditFactor("keywordField", "Keyword field", 15, null, "discoverability", [
      auditCheck(
        "keyword-field-saved",
        "Keyword field",
        "unanswered",
        null,
        "No keyword field saved.",
        {
          source: "keywords",
          unlock: {
            kind: "keyword-field",
            label: "Paste your keyword field from App Store Connect",
          },
        },
      ),
    ]),
    auditFactor("description", "Description", 5, 8, "conversion", [
      auditCheck(
        "description-hook",
        "Strong opening hook",
        "pass",
        10,
        "The description opens with \u201cGuess where you are\u201d.",
        { kind: "heuristic" },
      ),
    ]),
    auditFactor("screenshots", "Screenshots", 15, 7.4, "conversion", [
      auditCheck(
        "screenshots-count",
        "All slots used",
        "pass",
        10,
        "8 of 8 recommended screenshots used.",
      ),
      auditCheck(
        "screenshots-captions",
        "Readable captions",
        "warn",
        6.7,
        "2 of the first 3 screenshots carry a readable caption.",
        { kind: "ai", source: "ai" },
      ),
    ]),
    auditFactor("previewVideo", "Preview video", 5, null, "conversion", [], {
      availability: "not-measurable",
      confidence: 0,
    }),
    auditFactor("ratings", "Ratings & reviews", 15, 8.2, "conversion", [
      auditCheck(
        "ratings-average",
        "Average rating",
        "pass",
        9.2,
        "Average rating is 4.60.",
      ),
    ]),
    auditFactor("icon", "Icon", 5, 8, "conversion", [
      auditCheck(
        "icon-no-text",
        "No text",
        "pass",
        10,
        "The icon contains no text.",
        {
          kind: "ai",
          source: "ai",
        },
      ),
    ]),
    auditFactor("rankings", "Keyword rankings", 10, 5.5, "discoverability", [
      auditCheck(
        "rankings-visibility",
        "Search visibility",
        "warn",
        5.5,
        "Visibility is 27.4.",
        { source: "rankings" },
      ),
    ]),
    auditFactor("conversion", "Freshness and trust", 5, 9, "conversion", [
      auditCheck(
        "conversion-update-recency",
        "Update recency",
        "pass",
        10,
        "The last update was 12 days ago.",
      ),
    ]),
  ],
  limitations: APP_STORE_LIMITATIONS,
  unlocks: [
    {
      kind: "keyword-field",
      label: "Paste your keyword field from App Store Connect",
      checks: 1,
    },
  ],
  recommendations: {
    quickWins: [
      recommendation(
        "subtitle",
        "subtitle-length",
        "Add a subtitle",
        4.2,
        "minutes",
        "metadata",
      ),
      recommendation(
        "title",
        "title-length",
        "Use the 11 unused title characters",
        2.1,
        "minutes",
        "metadata",
      ),
    ],
    highImpact: [
      recommendation(
        "screenshots",
        "screenshots-captions",
        "Add readable captions to your first screenshots",
        1.8,
        "hours",
        "store-console",
      ),
    ],
    strategic: [
      recommendation(
        "rankings",
        "rankings-visibility",
        "Raise your search visibility",
        3.4,
        "weeks",
        "rankings",
      ),
    ],
  },
  creative: {
    analyzedAt: utcTimestampDaysAgo(1),
    model: "gpt-5.6-luna",
    stale: false,
    icon: {
      url: "https://is1-ssl.mzstatic.com/image/icon.png",
      hasText: false,
      elementCount: "one",
      contrast: "high",
      similarCompetitor: null,
    },
    screenshots: CREATIVE_SCREENSHOTS,
  },
  benchmarks: {
    competitors: 3,
    rows: [
      {
        metric: "rating-average",
        label: "Average rating",
        better: "higher",
        you: 4.68104,
        median: 4.65226,
        best: 4.76438,
        bestAppId: "c2",
      },
      {
        metric: "rating-count",
        label: "Ratings",
        better: "higher",
        you: 30853,
        median: 328427,
        best: 350099,
        bestAppId: "c1",
      },
      {
        metric: "screenshots",
        label: "Screenshots",
        better: "higher",
        you: 8,
        median: 6,
        best: 10,
        bestAppId: "c2",
      },
      {
        metric: "days-since-update",
        label: "Days since update",
        better: "lower",
        you: 12,
        median: 20,
        best: 5,
        bestAppId: "c1",
      },
    ],
  },
  ai: {
    configured: false,
    model: null,
    generatedAt: null,
    stale: false,
    run: null,
  },
  generatedAt: utcTimestampDaysAgo(1),
};

export const PLAY_AUDIT: AppAuditResult = {
  ...APP_AUDIT,
  appId: "app-gp",
  store: "GOOGLE_PLAY",
  totalWeight: 105,
  limitations: PLAY_LIMITATIONS,
  recommendations: {
    quickWins: [
      recommendation(
        "shortDescription",
        "short-description-keyword",
        "Put your priority keywords in the short description",
        2.4,
        "minutes",
        "metadata",
      ),
    ],
    highImpact: [],
    strategic: [
      recommendation(
        "rankings",
        "rankings-visibility",
        "Raise your search visibility",
        3.4,
        "weeks",
        "rankings",
      ),
    ],
  },
  creative: null,
  ai: {
    configured: false,
    model: null,
    generatedAt: null,
    stale: false,
    run: null,
  },
  factors: [
    auditFactor("title", "Title", 20, 9.1, "discoverability", [
      auditCheck(
        "title-keyword",
        "Primary keyword in title",
        "pass",
        10,
        "The title contains \u201cgeo quiz\u201d, a primary keyword.",
        { source: "keywords" },
      ),
    ]),
    auditFactor(
      "shortDescription",
      "Short description",
      15,
      6.4,
      "discoverability",
      [
        auditCheck(
          "short-description-keyword",
          "Priority keywords present",
          "warn",
          6,
          "1 of 2 priority keywords appear in the short description.",
          { source: "keywords" },
        ),
      ],
    ),
    auditFactor("description", "Description", 15, 7.2, "discoverability", [
      auditCheck(
        "description-keyword-coverage",
        "Priority keywords covered",
        "pass",
        10,
        "8 of 10 priority keywords appear in the description.",
        { source: "keywords" },
      ),
    ]),
    auditFactor(
      "screenshots",
      "Screenshots and feature graphic",
      15,
      7.4,
      "conversion",
      [
        auditCheck(
          "screenshots-feature-graphic",
          "Feature graphic",
          "pass",
          10,
          "A feature graphic is set.",
        ),
      ],
    ),
    auditFactor("previewVideo", "Preview video", 5, 10, "conversion", [
      auditCheck(
        "preview-video-present",
        "Promo video linked",
        "pass",
        10,
        "A promo video is linked.",
      ),
    ]),
    auditFactor("ratings", "Ratings & reviews", 15, 8.2, "conversion", [
      auditCheck(
        "ratings-average",
        "Average rating",
        "pass",
        9.2,
        "Average rating is 4.40.",
      ),
    ]),
    auditFactor("icon", "Icon", 5, 8, "conversion", [
      auditCheck(
        "icon-no-text",
        "No text",
        "pass",
        10,
        "The icon contains no text.",
        {
          kind: "ai",
          source: "ai",
        },
      ),
    ]),
    auditFactor("rankings", "Keyword rankings", 10, 5.5, "discoverability", [
      auditCheck(
        "rankings-visibility",
        "Search visibility",
        "warn",
        5.5,
        "Visibility is 27.4.",
        { source: "rankings" },
      ),
    ]),
    auditFactor("conversion", "Freshness and trust", 5, 9, "conversion", [
      auditCheck(
        "conversion-privacy-policy",
        "Privacy policy",
        "pass",
        10,
        "A privacy policy is linked.",
      ),
    ]),
  ],
  unlocks: [],
};

export const AUDIT_HISTORY_POINTS = [
  {
    date: utcDaysAgo(1),
    overall: 68.4,
    coveredWeight: 90,
    totalWeight: 110,
    rubricVersion: "v2",
    confidence: 0.82,
  },
];

const LONG_TEXT =
  "Kiedy pomiar nie potwierdza oczekiwan, audyt nazywa dokladnie ten warunek, ktory nie zostal spelniony, zamiast powtarzac ogolne stwierdzenie o brakujacych danych w tym miejscu";

export const LONG_AUDIT: AppAuditResult = {
  ...APP_AUDIT,
  appId: "app-long",
  factors: APP_AUDIT.factors.map((factor) => ({
    ...factor,
    checks: factor.checks.map((check) => ({ ...check, detail: LONG_TEXT })),
  })),
  recommendations: {
    quickWins: APP_AUDIT.recommendations.quickWins.map((item) => ({
      ...item,
      label: LONG_TEXT,
      detail: LONG_TEXT,
      fix: LONG_TEXT,
    })),
    highImpact: APP_AUDIT.recommendations.highImpact,
    strategic: APP_AUDIT.recommendations.strategic,
  },
};

export const PROVISIONAL_AUDIT: AppAuditResult = {
  ...APP_AUDIT,
  overall: 58.2,
  grade: "C",
  confidence: 0.55,
  potential: 74.1,
  recommendations: {
    quickWins: APP_AUDIT.recommendations.quickWins,
    highImpact: [],
    strategic: APP_AUDIT.recommendations.strategic,
  },
  unlocks: [
    {
      kind: "ai-analysis",
      label: "Add OPENAI_API_KEY to analyze your icon and screenshots",
      checks: 9,
    },
    {
      kind: "keyword-field",
      label: "Paste your keyword field from App Store Connect",
      checks: 1,
    },
  ],
};

const TOP_CHART_ICON = (slug: string) =>
  `https://is1-ssl.mzstatic.com/image/thumb/e2e-${slug}/100x100bb.png`;

function chartRow(
  position: number,
  title: string,
  previous: number | null,
  overrides: Partial<ChartEntryItem> = {},
): ChartEntryItem {
  const slug = title.toLowerCase().replaceAll(" ", "-");
  const delta = previous === null ? null : position - previous;
  return {
    position,
    storeAppId: String(6_400_000_000 + position),
    title,
    developer: `${title} Labs`,
    iconUrl: position <= 2 ? TOP_CHART_ICON(slug) : null,
    genreId: "6014",
    genreName: "Games",
    free: true,
    previous,
    delta,
    movement:
      delta === null ? "new" : delta < 0 ? "up" : delta > 0 ? "down" : "same",
    ...overrides,
  };
}

export const TOP_CHART_APPS: ChartEntryItem[] = [
  chartRow(1, "Puzzle Quest", 3),
  chartRow(2, "Tower Builder", 1),
  chartRow(3, "Word Garden", 3),
  chartRow(4, "Star Racer", null),
  chartRow(5, "Card Castle", 9, { free: false }),
  chartRow(6, "Ocean Match", 5),
  chartRow(7, "Farm Story", null, { developer: null }),
  chartRow(8, "Block Drop", 12),
  chartRow(9, "Chess Club", 7, { developer: null, genreName: "Board" }),
  chartRow(10, "Bubble Pop", 10),
];

export const TOP_PAID_CHART_APPS: ChartEntryItem[] = [
  "Sleep Pro",
  "Photo Pro",
  "Notes Pro",
  "Budget Pro",
  "Weather Pro",
  "Habit Pro",
  "Scanner Pro",
  "Workout Pro",
  "Recipe Pro",
  "Journal Pro",
].map((title, index) =>
  chartRow(index + 1, title, index + 2, {
    storeAppId: String(6_400_001_000 + index + 1),
    free: false,
  }),
);

export const TOP_GROSSING_CHART_APPS: ChartEntryItem[] = [
  "Kingdom Clash",
  "Dragon Legends",
  "Slot Palace",
  "Merge Manor",
  "Racing Rivals",
  "Hero Arena",
  "Bingo Bash",
  "Tile Town",
  "Space Siege",
  "Golf Tour",
].map((title, index) =>
  chartRow(index + 1, title, index % 2 === 0 ? index + 3 : index, {
    storeAppId: String(6_400_002_000 + index + 1),
    free: index % 3 !== 0,
  }),
);

const TOP_CHART_ROWS: Record<CategoryCollection, ChartEntryItem[]> = {
  free: TOP_CHART_APPS,
  paid: TOP_PAID_CHART_APPS,
  grossing: TOP_GROSSING_CHART_APPS,
};

export const TOP_CHART_DATES = [1, 2, 3, 5, 8].map(utcDaysAgo);

const moverOf = (row: ChartEntryItem): ChartMover => ({
  storeAppId: row.storeAppId,
  title: row.title,
  developer: row.developer,
  iconUrl: row.iconUrl,
  position: row.position,
  previous: row.previous,
  delta: row.delta,
});

const exitOf = (title: string, previous: number): ChartMover => ({
  ...moverOf(chartRow(previous, title, previous)),
  storeAppId: String(6_500_000_000 + previous),
  position: null,
  delta: null,
});

const CHART_KEY = {
  store: "APP_STORE",
  country: "us",
  collection: "free",
  genre: "6014",
  device: "iphone",
} as const;

export function topChartPage(
  date: string = TOP_CHART_DATES[0],
  collection: CategoryCollection = "free",
): ChartPage {
  const previous = TOP_CHART_DATES[TOP_CHART_DATES.indexOf(date) + 1];
  const rows = TOP_CHART_ROWS[collection];
  return {
    chart: { ...CHART_KEY, collection, genreName: "Games" },
    capture: { date, depth: 100, capturedAt: `${date}T03:10:00.000Z` },
    comparison: previous
      ? { date: previous, depth: 100, capturedAt: `${previous}T03:10:00.000Z` }
      : null,
    compare: "1d",
    entries: rows,
    trending: {
      climbers: [rows[7], rows[4]].map(moverOf),
      fallers: [rows[1], rows[5]].map(moverOf),
      entries: [rows[3], rows[6]].map(moverOf),
      exits: [exitOf("Snake Run", 4), exitOf("Gem Rush", 8)],
    },
    dates: TOP_CHART_DATES,
    today: utcDaysAgo(0),
    followed: null,
    apps: [
      {
        storeAppId: TOP_CHART_APPS[2].storeAppId,
        appId: APP_1.id,
        primaryAppId: null,
        name: APP_1.name,
        role: "own",
      },
      {
        storeAppId: TOP_CHART_APPS[4].storeAppId,
        appId: "competitor-chart",
        primaryAppId: APP_1.id,
        name: APP_1.name,
        role: "competitor",
      },
    ],
  };
}

export const TOP_CHART_PAGE_EMPTY: ChartPage = {
  ...topChartPage(),
  capture: null,
  comparison: null,
  entries: [],
  trending: { climbers: [], fallers: [], entries: [], exits: [] },
};

export const TOP_CHART_PAGE_UNCAPTURED: ChartPage = {
  ...TOP_CHART_PAGE_EMPTY,
  dates: [],
};

export function chartCaptureSpent(path: string): ApiErrorEnvelope {
  return {
    statusCode: 429,
    error: "Too Many Requests",
    message:
      "Chart capture limit reached: the indie plan allows 30 requests per day. Try again in 3 hours.",
    path,
    timestamp: new Date().toISOString(),
    rateLimit: {
      window: "day",
      rateClass: "store",
      plan: "indie",
      limit: 30,
      resetSeconds: 10_800,
      upgradeTo: "ultimate",
      action: "chartCapture",
    },
    retryAfterSeconds: 10_800,
  };
}

DATASETS[APP_HUF_ID] = pricedDataset(
  APP_HUF_ID,
  "Forint Priced",
  1490,
  "HUF",
  [],
);
