import type {
  ActionItem,
  ActionSummary,
  AlertDeliveryItem,
  ApiErrorEnvelope,
  AppDetail,
  AppListItem,
  AppSummary,
  CategoryRankSeries,
  CompetitorDiscovery,
  DailyBudget,
  EmailAlertItem,
  KeywordComparison,
  KeywordCountrySummary,
  ChangeTimeline,
  CompetitorItem,
  HealthStatus,
  WorkspaceRunStatus,
  PortfolioSummary,
  RankDistributionHistory,
  RankingPoint,
  RankingSeries,
  RatingsHistory,
  ReviewList,
  SerpMovers,
  AppAuditResult,
  MetadataAuditResult,
  TrackedKeywordItem,
  VisibilityHistory,
  WebhookItem,
} from "@asobeast/shared";
import { RANK_DEPTH } from "@asobeast/shared";

function utcDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function utcTimestampDaysAgo(days: number): string {
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

export const APP_1_KEYWORDS: TrackedKeywordItem[] = [
  {
    keywordId: "kw-1",
    text: "focus timer",
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
      source: "APPLE_SUGGEST_SEARCH",
      formulaVersion: "app-store-v1",
      confidence: "HIGH",
      capturedAt: utcTimestampDaysAgo(0),
    },
  },
  {
    keywordId: "kw-2",
    text: "pomodoro",
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
      source: "GOOGLE_PLAY_PREFIX_SEARCH",
      formulaVersion: "google-play-v1",
      confidence: "MEDIUM",
      capturedAt: utcTimestampDaysAgo(1),
    },
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
  },
  {
    keywordId: "kw-5",
    text: "time blocking",
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
      genreName: "Productivity",
      current: 42,
      points: Array.from({ length: 30 }, (_, index) => ({
        date: utcDaysAgo(29 - index),
        position: 60 - index,
      })),
    },
  ],
};

export const APP_1_REVIEWS: ReviewList = {
  total: 3,
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
    },
  ],
};

export const APP_1_RATINGS_HISTORY: RatingsHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    ratingAvg: 4.6 + (index % 4) * 0.05,
    ratingCount: 20000 + index * 130,
  })),
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

export const APP_2: AppListItem = {
  id: "app-2",
  store: "APP_STORE",
  country: "us",
  name: "Habit Tracker",
  iconUrl: null,
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
const EMPTY_SERP_MOVERS: SerpMovers = { windowDays: 7, items: [] };
const EMPTY_CHANGES: ChangeTimeline = { events: [] };
const EMPTY_DISCOVERY: CompetitorDiscovery = { windowDays: 30, items: [] };
const EMPTY_COMPARISON: KeywordComparison = { competitors: [], rows: [] };

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
      traffic: 55,
      difficulty: 4,
      you: 3,
      positions: { "comp-1": 9 },
      gap: false,
    },
    {
      keywordId: "kw-2",
      text: "pomodoro",
      traffic: 70,
      difficulty: 7,
      you: 12,
      positions: { "comp-1": 4 },
      gap: false,
    },
    {
      keywordId: "kw-4",
      text: "productivity app",
      traffic: 65,
      difficulty: 6,
      you: null,
      positions: { "comp-1": 8 },
      gap: true,
    },
    {
      keywordId: "kw-5",
      text: "time blocking",
      traffic: null,
      difficulty: null,
      you: 45,
      positions: { "comp-1": null },
      gap: false,
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
      id: "app-chg-5",
      appId: "app-1",
      appName: "Focus Timer",
      isCompetitor: false,
      field: "icon",
      before: null,
      after: null,
      capturedAt: utcTimestampDaysAgo(12),
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

export const APP_BULK_DETAIL: AppDetail = {
  ...APP_LONG_DETAIL,
  id: "app-bulk",
  name: "Bulk Keywords App",
};

export const APP_LONG: AppListItem = {
  id: "app-long",
  store: "APP_STORE",
  country: "us",
  name: LONG_NAME,
  iconUrl: null,
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
  ratingsHistory: RatingsHistory;
  changes: ChangeTimeline;
  discovery: CompetitorDiscovery;
  comparison: KeywordComparison;
}

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
    ratingsHistory: APP_1_RATINGS_HISTORY,
    changes: APP_1_CHANGES,
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
    changes: EMPTY_CHANGES,
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
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    changes: EMPTY_CHANGES,
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
    changes: EMPTY_CHANGES,
    discovery: EMPTY_DISCOVERY,
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
    reviews: EMPTY_REVIEWS,
    ratingsHistory: EMPTY_RATINGS_HISTORY,
    changes: EMPTY_CHANGES,
    discovery: APP_GP_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
  "app-new": {
    detail: IMPORTED_APP_DETAIL,
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
    changes: EMPTY_CHANGES,
    discovery: EMPTY_DISCOVERY,
    comparison: EMPTY_COMPARISON,
  },
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
      iconUrl: null,
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
];

export const BUDGET: DailyBudget = {
  apps: 3,
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
      capturedAt: utcTimestampDaysAgo(1),
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
  reopenCount: 0,
  note: null,
  ai: { explanation: null, model: null, generatedAt: null },
} as const;

const APP_SCOPE = {
  appId: "app-1",
  appName: "Habit Tracker",
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
      budgetUtilization: 0.72,
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
      budgetUtilization: 0.7,
    },
  },
];

export const ACTION_SUMMARY: ActionSummary = {
  open: 9,
  snoozed: 1,
  byPriority: { critical: 1, high: 4, medium: 4, low: 2 },
  byCategory: {
    metadata: 2,
    competition: 2,
    regression: 1,
    conversion: 2,
    reputation: 1,
    markets: 1,
    hygiene: 2,
  },
  topRules: [
    { rule: "keyword.add_uncovered", count: 2 },
    { rule: "keyword.defend", count: 2 },
  ],
  generatedAt: "2026-07-30T03:00:00.000Z",
  suppressedByCap: 3,
};

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
    },
  ],
  keywordFieldSuggestion: null,
};

export const APP_AUDIT: AppAuditResult = {
  appId: "app-1",
  store: "APP_STORE",
  overall: 72,
  coveredWeight: 8,
  totalWeight: 10,
  factors: [
    {
      id: "title-keywords",
      label: "Title keywords",
      weight: 3,
      score: 9,
      needsInput: false,
      checks: [
        {
          id: "title-length",
          label: "Title uses its characters",
          kind: "auto",
          status: "pass",
          score: 10,
          detail: "11 of 30 characters used.",
        },
      ],
    },
    {
      id: "subtitle-keywords",
      label: "Subtitle keywords",
      weight: 2,
      score: 5,
      needsInput: false,
      checks: [
        {
          id: "subtitle-terms",
          label: "Subtitle adds new terms",
          kind: "heuristic",
          status: "warn",
          score: 5,
          detail: "Two terms repeat the title.",
        },
      ],
    },
    {
      id: "screenshots",
      label: "Screenshots",
      weight: 3,
      score: 2,
      needsInput: false,
      checks: [
        {
          id: "screenshot-count",
          label: "Screenshot count",
          kind: "auto",
          status: "fail",
          score: 2,
          detail: "Only 2 of 10 slots are used.",
        },
      ],
    },
  ],
  recommendations: { quickWins: [], highImpact: [], strategic: [] },
  ai: { configured: false, model: null, generatedAt: null },
  generatedAt: utcTimestampDaysAgo(1),
};
