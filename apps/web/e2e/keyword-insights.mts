import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  APP_1_DETAIL,
  APP_1_KEYWORDS,
  DATASETS,
  utcDaysAgo,
} from "./fixtures.mts";

export const APP_INSIGHTS_ID = "app-insights";

const row = (
  text: string,
  fields: Partial<TrackedKeywordItem>,
): TrackedKeywordItem => ({
  ...APP_1_KEYWORDS[0],
  keywordId: `kw-insight-${text}`,
  text,
  tags: [],
  dropStreak: 0,
  uncovered: false,
  latestPosition: 50,
  latestCheckedOn: utcDaysAgo(0),
  volume: 10,
  difficulty: 5,
  relevance: 40,
  scoreSignals: null,
  ...fields,
});

export const INSIGHT_MATRIX: Record<string, string[]> = {
  "streak 2": [],
  "streak 3": ["Dropping"],
  "position 10": [],
  "position 11": ["Page 1 close"],
  "position 13": ["Page 1 close"],
  "position 14": [],
  "stale 12": [],
  "popularity 19": [],
  "popularity 20": ["Beatable"],
  "difficulty equal": [],
  "relevance 59": [],
  "relevance 60": ["Not in listing"],
  "covered 80": [],
  "paused all": [],
};

export const APP_INSIGHTS_KEYWORDS: TrackedKeywordItem[] = [
  row("streak 2", { dropStreak: 2 }),
  row("streak 3", { dropStreak: 3 }),
  row("position 10", { latestPosition: 10 }),
  row("position 11", { latestPosition: 11 }),
  row("position 13", { latestPosition: 13 }),
  row("position 14", { latestPosition: 14 }),
  row("stale 12", { latestPosition: 12, latestCheckedOn: utcDaysAgo(3) }),
  row("popularity 19", { volume: 19, difficulty: 0.5 }),
  row("popularity 20", { volume: 20, difficulty: 0.5 }),
  row("difficulty equal", { volume: 40, difficulty: 4 }),
  row("relevance 59", { relevance: 59, uncovered: true }),
  row("relevance 60", { relevance: 60, uncovered: true }),
  row("covered 80", { relevance: 80, uncovered: false }),
  row("paused all", {
    active: false,
    dropStreak: 5,
    latestPosition: 12,
    volume: 60,
    difficulty: 1,
    relevance: 90,
    uncovered: true,
  }),
];

DATASETS[APP_INSIGHTS_ID] = {
  ...DATASETS["app-1"],
  detail: { ...APP_1_DETAIL, id: APP_INSIGHTS_ID, name: "Insights Lab" },
  keywords: APP_INSIGHTS_KEYWORDS,
};
