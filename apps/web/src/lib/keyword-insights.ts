import {
  KEYWORD_MIN_RELEVANCE,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { staleCheckDay } from "./keyword-checks";
import { hasFloorAnswer, scoreValue, shownScore } from "./keyword-scores";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const KEYWORD_INSIGHTS = [
  "dropping",
  "pageOneClose",
  "beatable",
  "notInListing",
] as const;

export type KeywordInsight = (typeof KEYWORD_INSIGHTS)[number];

export const INSIGHT_LABELS: Record<KeywordInsight, string> = {
  dropping: enKeywords.insights.labels.dropping,
  pageOneClose: enKeywords.insights.labels.pageOneClose,
  beatable: enKeywords.insights.labels.beatable,
  notInListing: enKeywords.insights.labels.notInListing,
};

export function insightLabel(
  insight: KeywordInsight,
  t: MessageTranslator = english,
): string {
  return t(`insights.labels.${insight}`);
}

export const MAX_SHOWN_INSIGHTS = 2;
export const DROPPING_MIN_STREAK = 3;
export const PAGE_ONE_CLOSE_MIN_POSITION = 11;
export const PAGE_ONE_CLOSE_MAX_POSITION = 13;
export const BEATABLE_MIN_POPULARITY = 20;

const TOP_TEN = 10;

const shownPopularity = (row: TrackedKeywordItem): number | null =>
  shownScore(scoreValue(row, "traffic"));

const shownDifficulty = (row: TrackedKeywordItem): number | null =>
  shownScore(scoreValue(row, "difficulty"));

const isDropping = (row: TrackedKeywordItem): boolean =>
  (row.dropStreak ?? 0) >= DROPPING_MIN_STREAK;

const isPageOneClose = (row: TrackedKeywordItem, today: string): boolean =>
  row.latestDepth !== null &&
  row.latestPosition !== null &&
  row.latestPosition >= PAGE_ONE_CLOSE_MIN_POSITION &&
  row.latestPosition <= PAGE_ONE_CLOSE_MAX_POSITION &&
  typeof row.latestCheckedOn === "string" &&
  staleCheckDay(row, today) === null;

function isBeatable(row: TrackedKeywordItem): boolean {
  const popularity = shownPopularity(row);
  const difficulty = shownDifficulty(row);
  return (
    popularity !== null &&
    difficulty !== null &&
    !hasFloorAnswer(row) &&
    popularity >= BEATABLE_MIN_POPULARITY &&
    difficulty < popularity
  );
}

const isNotInListing = (row: TrackedKeywordItem): boolean =>
  row.uncovered === true &&
  row.relevance !== null &&
  row.relevance >= KEYWORD_MIN_RELEVANCE;

const INSIGHT_RULES: Record<
  KeywordInsight,
  (row: TrackedKeywordItem, today: string) => boolean
> = {
  dropping: isDropping,
  pageOneClose: isPageOneClose,
  beatable: isBeatable,
  notInListing: isNotInListing,
};

export function insightsOf(
  row: TrackedKeywordItem,
  today: string,
): KeywordInsight[] {
  if (!row.active) return [];
  return KEYWORD_INSIGHTS.filter((insight) =>
    INSIGHT_RULES[insight](row, today),
  );
}

export const shownInsights = (
  insights: readonly KeywordInsight[],
): KeywordInsight[] => insights.slice(0, MAX_SHOWN_INSIGHTS);

export function insightDetail(
  row: TrackedKeywordItem,
  insight: KeywordInsight,
  t: MessageTranslator = english,
): string {
  switch (insight) {
    case "dropping":
      return t("insights.detail.dropping", {
        count: row.dropStreak ?? 0,
      });
    case "pageOneClose":
      return t("insights.detail.pageOneClose", {
        count: (row.latestPosition ?? TOP_TEN) - TOP_TEN,
      });
    case "beatable":
      return t("insights.detail.beatable", {
        difficulty: shownDifficulty(row) ?? 0,
        popularity: shownPopularity(row) ?? 0,
      });
    case "notInListing":
      return t("insights.detail.notInListing");
  }
}

export const insightsCsv = (
  row: TrackedKeywordItem,
  today: string,
  t: MessageTranslator = english,
): string =>
  insightsOf(row, today)
    .map((insight) => insightLabel(insight, t))
    .join("; ");
