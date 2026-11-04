import { RANK_DEPTH } from "@asobeast/shared";
import type {
  RankingPoint,
  RankingSeries,
  ScoreSignals,
  TrackedKeywordItem,
} from "@asobeast/shared";
import {
  APP_1_DETAIL,
  DATASETS,
  utcDaysAgo,
  utcTimestampDaysAgo,
} from "./fixtures.mts";

export const APP_MAP_ID = "app-map";

export const MAP_DEFAULT_COUNTS = {
  quickWins: 8,
  worthFighting: 7,
  easyPickings: 4,
  lowPriority: 4,
  unplotted: 2,
} as const;

export const MAP_LABELLED = [
  "study timer",
  "world flags",
  "focus timer",
  "paused phrase",
  "habit timer",
] as const;

const MAP_FLOOR_WEEK = "2026-10-18";

interface MapKeyword {
  text: string;
  volume: number | null;
  difficulty: number | null;
  position: number | null;
  opportunity: number | null;
  tags?: string[];
  active?: boolean;
  signals?: Partial<ScoreSignals>;
}

const floorSignals = (
  state: "floor" | "absent",
  volume: number,
): Partial<ScoreSignals> => ({
  officialPopularity: state === "floor" ? volume : null,
  officialPopularityState: state,
  officialPopularityFloor: 41,
  officialPopularityWeek: MAP_FLOOR_WEEK,
});

const scoredKeyword = (
  index: number,
  {
    text,
    volume,
    difficulty,
    position,
    opportunity,
    tags,
    active = true,
    signals,
  }: MapKeyword,
): TrackedKeywordItem => ({
  keywordId: `kw-map-${index}`,
  text,
  country: "us",
  serpVolatility7d: null,
  source: "MANUAL",
  active,
  latestPosition: position,
  latestDepth: RANK_DEPTH,
  latestCheckedOn: utcDaysAgo(0),
  previousPosition: position,
  positionDelta1d: position === null ? null : 0,
  positionDelta7d: position === null ? null : 0,
  traffic: volume === null ? null : volume / 10,
  difficulty,
  volume,
  relevance: 60,
  opportunity,
  bucket: "secondary",
  competitorsInTop10: null,
  scoredAt: utcTimestampDaysAgo(0),
  scoreProvenance: {
    source: "APPLE_SEARCH_SIGNALS",
    confidence: "HIGH",
    formulaVersion: "app-store-v5",
    capturedAt: utcTimestampDaysAgo(0),
  },
  scoreSignals: {
    suggestReach: "hit",
    suggestPrefixLength: 3,
    suggestPosition: 2,
    serpRelevance: 0.8,
    medianRatingCount: 12000,
    flags: [],
    officialPopularity: null,
    estimatedTraffic: volume === null ? null : volume / 10,
    ...signals,
  },
  scoreOutdated: false,
  ...(tags === undefined ? {} : { tags }),
});

const neverChecked = (index: number, text: string): TrackedKeywordItem => ({
  ...scoredKeyword(index, {
    text,
    volume: null,
    difficulty: null,
    position: null,
    opportunity: null,
  }),
  latestDepth: null,
  latestCheckedOn: null,
  traffic: null,
  scoredAt: null,
  scoreProvenance: null,
  scoreSignals: null,
});

const SCORED: MapKeyword[] = [
  {
    text: "focus timer",
    volume: 62,
    difficulty: 1.8,
    position: 3,
    opportunity: 82,
    tags: ["core"],
  },
  {
    text: "pomodoro app",
    volume: 48,
    difficulty: 2.2,
    position: 12,
    opportunity: 78,
  },
  {
    text: "study timer",
    volume: 35,
    difficulty: 1.2,
    position: null,
    opportunity: 88,
    tags: ["core"],
  },
  {
    text: "deep work timer",
    volume: 20,
    difficulty: 2.5,
    position: 41,
    opportunity: 45,
  },
  {
    text: "exam countdown",
    volume: 27,
    difficulty: 2.54,
    position: null,
    opportunity: 65,
  },
  {
    text: "habit timer",
    volume: 55,
    difficulty: 2.0,
    position: 7,
    opportunity: 80,
    tags: ["core"],
  },
  {
    text: "paused phrase",
    volume: 33,
    difficulty: 1.9,
    position: 9,
    opportunity: 81,
    active: false,
  },
  {
    text: "world flags",
    volume: 41,
    difficulty: 1.5,
    position: null,
    opportunity: 85,
    signals: floorSignals("floor", 41),
  },
  {
    text: "productivity",
    volume: 88,
    difficulty: 8.4,
    position: 64,
    opportunity: 16,
    tags: ["core"],
  },
  {
    text: "to do list",
    volume: 92,
    difficulty: 9.1,
    position: null,
    opportunity: 9,
  },
  {
    text: "time management",
    volume: 64,
    difficulty: 6.0,
    position: 33,
    opportunity: 40,
  },
  {
    text: "planner",
    volume: 74,
    difficulty: 7.5,
    position: null,
    opportunity: 25,
  },
  {
    text: "focus app",
    volume: 58,
    difficulty: 2.6,
    position: 19,
    opportunity: 74,
  },
  {
    text: "task manager",
    volume: 71,
    difficulty: 7.0,
    position: null,
    opportunity: 30,
  },
  {
    text: "flag trivia",
    volume: 30,
    difficulty: 4.0,
    position: 25,
    opportunity: 60,
    signals: floorSignals("absent", 30),
  },
  {
    text: "countdown to exams",
    volume: 14,
    difficulty: 1.0,
    position: 2,
    opportunity: 34,
  },
  {
    text: "timer for studying",
    volume: 9,
    difficulty: 0.8,
    position: null,
    opportunity: 20,
  },
  {
    text: "pomodoro tracker",
    volume: 19,
    difficulty: 2.4,
    position: 5,
    opportunity: 43,
  },
  {
    text: "tiny timer",
    volume: 4,
    difficulty: 0.5,
    position: null,
    opportunity: 8,
  },
  {
    text: "timer",
    volume: 18,
    difficulty: 7.8,
    position: 120,
    opportunity: 12,
  },
  { text: "clock", volume: 6, difficulty: 9.4, position: null, opportunity: 1 },
  {
    text: "countdown",
    volume: 10,
    difficulty: 5.5,
    position: null,
    opportunity: 11,
  },
  {
    text: "stopwatch",
    volume: 19,
    difficulty: 2.6,
    position: null,
    opportunity: 42,
  },
];

export const APP_MAP_KEYWORDS: TrackedKeywordItem[] = [
  ...SCORED.map((keyword, index) => scoredKeyword(index + 1, keyword)),
  neverChecked(24, "new phrase one"),
  scoredKeyword(25, {
    text: "half scored",
    volume: 40,
    difficulty: null,
    position: null,
    opportunity: null,
  }),
];

const descendingSeries = (from: number, to: number): RankingPoint[] =>
  Array.from({ length: 14 }, (_, index) => ({
    date: utcDaysAgo(13 - index),
    position: Math.round(from - ((from - to) * index) / 13),
    depth: RANK_DEPTH,
  }));

const MAP_RANKINGS: RankingSeries = {
  series: [
    {
      keywordId: "kw-map-1",
      text: "focus timer",
      store: "APP_STORE",
      country: "us",
      points: descendingSeries(9, 3),
    },
    {
      keywordId: "kw-map-6",
      text: "habit timer",
      store: "APP_STORE",
      country: "us",
      points: descendingSeries(12, 7),
    },
  ],
};

DATASETS[APP_MAP_ID] = {
  ...DATASETS["app-1"],
  detail: { ...APP_1_DETAIL, id: APP_MAP_ID, name: "Opportunity Map Lab" },
  keywords: APP_MAP_KEYWORDS,
  rankings: MAP_RANKINGS,
};
