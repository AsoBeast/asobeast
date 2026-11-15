import type {
  KeywordInspection,
  KeywordInspectionResult,
  Store,
} from "@asobeast/shared";

export const SEEDED_KEYWORD = "habit tracker";

export const SEEDED_ID = "seeded-habit-tracker";

export const SEEDED_PREVIOUS_ID = "seeded-habit-tracker-before";

export const SEEDED_PLAY_ID = "seeded-habit-tracker-play";

export const LONG_KEYWORD =
  "daily habit tracker and routine planner for people with adhd";

export const RTL_KEYWORD = "متتبع العادات";

export const SEEDED_FAILURE =
  "The App Store did not answer. Try again in a few minutes.";

interface Seed {
  id: string;
  keyword: string;
  store?: Store;
  country?: string;
  at: string;
  scores?: [number | null, number | null, number | null];
  status?: KeywordInspection["status"];
}

const SEEDS: readonly Seed[] = [
  {
    id: "seeded-sleep-sounds",
    keyword: "sleep sounds",
    at: "2026-11-14T08:10:00.000Z",
    status: "PENDING",
  },
  {
    id: SEEDED_ID,
    keyword: SEEDED_KEYWORD,
    at: "2026-11-14T08:02:00.000Z",
    scores: [46.4, 38.2, 61],
  },
  {
    id: "seeded-habit-tracker-app",
    keyword: "habit tracker app",
    at: "2026-11-14T07:58:00.000Z",
    scores: [41, 33, 58],
  },
  {
    id: "seeded-streak-counter",
    keyword: "streak counter",
    at: "2026-11-13T16:40:00.000Z",
    scores: [18, 12, 44],
  },
  {
    id: "seeded-routine-builder",
    keyword: "routine builder",
    at: "2026-11-13T16:31:00.000Z",
    scores: [27, 22, 55],
  },
  {
    id: SEEDED_PLAY_ID,
    keyword: SEEDED_KEYWORD,
    store: "GOOGLE_PLAY",
    at: "2026-11-13T11:05:00.000Z",
    scores: [52, 44, 56],
  },
  {
    id: "seeded-store-timeout",
    keyword: "store timeout",
    at: "2026-11-13T10:58:00.000Z",
    status: "FAILED",
  },
  {
    id: "seeded-daily-planner",
    keyword: "daily planner",
    at: "2026-11-12T09:20:00.000Z",
    scores: [62, 71, 34],
  },
  {
    id: "seeded-mood-journal",
    keyword: "mood journal",
    at: "2026-11-12T09:14:00.000Z",
    scores: [55, 49, 47],
  },
  {
    id: "seeded-water-reminder",
    keyword: "water reminder",
    at: "2026-11-11T18:02:00.000Z",
    scores: [70, 82, 22],
  },
  {
    id: "seeded-focus-timer",
    keyword: "focus timer",
    at: "2026-11-11T17:55:00.000Z",
    scores: [38, 57, 30],
  },
  {
    id: "seeded-gewohnheitstracker",
    keyword: "gewohnheitstracker",
    country: "de",
    at: "2026-11-11T12:30:00.000Z",
    scores: [31, 24, 52],
  },
  {
    id: "seeded-rtl",
    keyword: RTL_KEYWORD,
    country: "sa",
    at: "2026-11-11T12:21:00.000Z",
    scores: [22, 15, 49],
  },
  {
    id: "seeded-long",
    keyword: LONG_KEYWORD,
    at: "2026-11-10T15:44:00.000Z",
    scores: [null, 19, null],
  },
  {
    id: SEEDED_PREVIOUS_ID,
    keyword: SEEDED_KEYWORD,
    at: "2026-11-10T09:12:00.000Z",
    scores: [42, 44, 52],
  },
];

const RESULTS: readonly [
  string,
  string,
  number,
  number,
  KeywordInspectionResult["titleMatch"],
  string,
  string,
][] = [
  [
    "Habit Tracker: Daily Goals",
    "Developer 1",
    4.5,
    250_000,
    "phrase",
    "2026-11-11",
    "2019-03-02",
  ],
  [
    "Streaks Planner",
    "Developer 2",
    4.5,
    125_000,
    "none",
    "2026-11-05",
    "2018-06-11",
  ],
  [
    "Routine Builder",
    "Developer 3",
    4.5,
    83_000,
    "none",
    "2026-11-02",
    "2026-04-20",
  ],
  [
    "Tiny Habits Tracker",
    "Small Steps Ltd",
    4.7,
    41_000,
    "words",
    "2026-11-09",
    "2021-01-14",
  ],
  [
    "Productive: Habit Builder",
    "Apalon",
    4.6,
    38_000,
    "partial",
    "2026-10-24",
    "2016-09-01",
  ],
  [
    "Loop Habit Tracker",
    "Loop Apps",
    4.8,
    21_000,
    "phrase",
    "2026-11-12",
    "2020-02-02",
  ],
  [
    "Goal Streak",
    "Streak Labs",
    4.3,
    12_000,
    "none",
    "2026-10-05",
    "2026-01-30",
  ],
  ["HabitBee", "Bee Studio", 4.4, 9_800, "partial", "2026-10-31", "2022-07-07"],
  [
    "Daily Routine Planner",
    "Planfold",
    4.1,
    6_200,
    "none",
    "2026-08-10",
    "2023-05-19",
  ],
  [
    "Habit Diary",
    "Quiet Apps",
    4.2,
    3_100,
    "partial",
    "2026-11-06",
    "2024-03-08",
  ],
  [
    "Streak Counter Lite",
    "Lite Apps",
    3.9,
    1_200,
    "none",
    "2026-06-01",
    "2024-11-11",
  ],
  [
    "Atomic Habit Coach",
    "Coach Co",
    4,
    820,
    "partial",
    "2026-09-18",
    "2025-02-27",
  ],
];

const titleSegments = (
  title: string,
  match: KeywordInspectionResult["titleMatch"],
) => {
  const at = title.toLowerCase().indexOf(SEEDED_KEYWORD);
  if (match !== "phrase" || at < 0)
    return [{ text: title, match: "none" as const }];
  return [
    { text: title.slice(0, at), match: "none" as const },
    {
      text: title.slice(at, at + SEEDED_KEYWORD.length),
      match: "exact" as const,
    },
    { text: title.slice(at + SEEDED_KEYWORD.length), match: "none" as const },
  ].filter((segment) => segment.text !== "");
};

const results = (): KeywordInspectionResult[] =>
  RESULTS.map(
    (
      [title, developer, ratingAvg, ratingCount, titleMatch, updated, released],
      index,
    ) => ({
      position: index + 1,
      storeAppId: `seeded-app-${index + 1}`,
      title,
      developer,
      iconUrl: null,
      ratingAvg,
      ratingCount,
      releasedAt: `${released}T00:00:00.000Z`,
      updatedAt: `${updated}T00:00:00.000Z`,
      titleMatch,
      titleSegments: titleSegments(title, titleMatch),
    }),
  );

function inspectionOf(seed: Seed): KeywordInspection {
  const store = seed.store ?? "APP_STORE";
  const country = seed.country ?? "us";
  const status = seed.status ?? "DONE";
  const [volume, difficulty100, opportunity] = seed.scores ?? [
    null,
    null,
    null,
  ];
  const done = status === "DONE";
  return {
    id: seed.id,
    keywordId: `seeded-keyword-${store}-${country}-${seed.keyword}`,
    keyword: seed.keyword,
    store,
    country,
    status,
    requestedAt: seed.at,
    startedAt: status === "PENDING" ? null : seed.at,
    completedAt: status === "PENDING" ? null : seed.at,
    volume,
    difficulty100,
    opportunity,
    resultCount: done ? 3 : null,
    provenance: done
      ? {
          source: "APPLE_SEARCH_SIGNALS",
          formulaVersion: "app-store-v5",
          confidence: "HIGH",
        }
      : null,
    suggestReach: done ? "hit" : null,
    signals: null,
    competition: null,
    results: [],
    suggestions: [],
    previous: null,
    failure: status === "FAILED" ? SEEDED_FAILURE : null,
  };
}

function detailed(base: KeywordInspection): KeywordInspection {
  const read = results();
  return {
    ...base,
    resultCount: read.length,
    signals: {
      suggestReach: "hit",
      suggestPrefixLength: 5,
      suggestPosition: 1,
      serpRelevance: 0.7,
      medianRatingCount: 16_000,
      flags: [],
      officialPopularity: null,
      estimatedTraffic: null,
    },
    competition: {
      topCount: 10,
      medianRatingCount: 16_000,
      strongestRatingCount: 250_000,
      averageRating: 4.5,
      exactTitleMatches: 2,
      titleMatches: 7,
      appsOverHundredThousandRatings: 2,
      medianDaysSinceUpdate: 12,
      freshlyUpdated: 8,
    },
    results: read,
    suggestions: [
      { position: 1, term: SEEDED_KEYWORD },
      { position: 2, term: "habit tracker app" },
      { position: 3, term: "habit tracker free" },
      { position: 4, term: "habit tracker widget" },
      { position: 5, term: "habit tracker for adhd" },
    ],
    previous: {
      inspectionId: SEEDED_PREVIOUS_ID,
      completedAt: "2026-11-10T09:12:00.000Z",
      volume: 42,
      difficulty100: 44,
      resultCount: 11,
      entered: [{ storeAppId: "seeded-app-3", title: "Routine Builder" }],
      left: [{ storeAppId: "seeded-gone", title: "Habit Journal Plus" }],
    },
  };
}

export function seededInspections(): KeywordInspection[] {
  return SEEDS.map((seed) => {
    const base = inspectionOf(seed);
    return seed.id === SEEDED_ID ? detailed(base) : base;
  });
}
