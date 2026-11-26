import type { Store } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatNumberInLocale, formatRating } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  displayedTenths,
  MAX_GOAL_DAYS,
  MAX_TARGET_TENTHS,
  MIN_GOAL_DAYS,
  MIN_TARGET_TENTHS,
  type GoalPace,
  type RatingsGoal,
  THIN_SAMPLE_COUNT,
} from "@/lib/ratings-goal";

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

export const formatTenths = (tenths: number): string =>
  formatRating(tenths / 10);

export const TARGET_HINT = `Enter a target from ${formatTenths(MIN_TARGET_TENTHS)} to ${formatTenths(MAX_TARGET_TENTHS)} with at most one decimal.`;

export const DAYS_HINT = `Enter a whole number of days from ${MIN_GOAL_DAYS} to ${MAX_GOAL_DAYS}.`;

function paceText(
  pace: GoalPace,
  t: MessageTranslator,
  locale: Locale,
): string {
  return pace.kind === "daily"
    ? t("goal.dailyPace", { count: formatNumberInLocale(pace.ratings, locale) })
    : t("goal.intervalPace", { count: pace.days });
}

export function goalSentence(
  goal: RatingsGoal,
  targetTenths: number,
  average: number,
  days: number,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const target = formatTenths(targetTenths);
  if (goal.kind === "first") {
    return t("goal.first", { target: formatTenths(MAX_TARGET_TENTHS) });
  }
  if (goal.kind === "reached") {
    const shown = displayedTenths(average);
    return shown === targetTenths
      ? t("goal.reached", { target })
      : t("goal.reachedAbove", {
          shown: formatTenths(shown),
          target,
        });
  }
  if (goal.ratings === 1) {
    return t("goal.oneMore", { target });
  }
  return t("goal.more", {
    target,
    count: formatNumberInLocale(goal.ratings, locale),
    pace: paceText(goal.pace, t, locale),
    days,
  });
}

export function goalNotes(
  store: Store,
  count: number,
  t: MessageTranslator = english,
): string[] {
  return [
    t("goal.assumes"),
    ...(store === "GOOGLE_PLAY" ? [t("goal.playWeight")] : []),
    ...(count < THIN_SAMPLE_COUNT
      ? [t("goal.thinSample", { count: THIN_SAMPLE_COUNT })]
      : []),
  ];
}
