import type { Store } from "@asobeast/shared";
import { formatNumber, formatRating, pluralize } from "@/lib/format";
import {
  displayedTenths,
  MAX_GOAL_DAYS,
  MAX_TARGET_TENTHS,
  MIN_GOAL_DAYS,
  MIN_TARGET_TENTHS,
  type GoalPace,
  type MixAnswer,
  type RatingsGoal,
  THIN_SAMPLE_COUNT,
} from "@/lib/ratings-goal";

export const formatTenths = (tenths: number): string =>
  formatRating(tenths / 10);

export const TARGET_HINT = `Enter a target from ${formatTenths(MIN_TARGET_TENTHS)} to ${formatTenths(MAX_TARGET_TENTHS)} with at most one decimal.`;

export const DAYS_HINT = `Enter a whole number of days from ${MIN_GOAL_DAYS} to ${MAX_GOAL_DAYS}.`;

function paceText(pace: GoalPace): string {
  return pace.kind === "daily"
    ? `about ${formatNumber(pace.ratings)} a day`
    : `about one every ${formatNumber(pace.days)} days`;
}

export function goalSentence(
  goal: RatingsGoal,
  targetTenths: number,
  average: number,
  days: number,
): string {
  const target = formatTenths(targetTenths);
  if (goal.kind === "first") {
    return `With no ratings yet, the first five-star rating shows ${formatTenths(MAX_TARGET_TENTHS)}.`;
  }
  if (goal.kind === "reached") {
    const shown = displayedTenths(average);
    return shown === targetTenths
      ? `The store already shows ${target}.`
      : `The store already shows ${formatTenths(shown)}, above ${target}.`;
  }
  if (goal.ratings === 1) {
    return `To show ${target} you need 1 more five-star rating.`;
  }
  return `To show ${target} you need ${formatNumber(goal.ratings)} more five-star ratings, ${paceText(goal.pace)} for ${pluralize(days, "day")}.`;
}

export function goalNotes(store: Store, count: number): string[] {
  return [
    "Assumes every new rating is five stars and that the store shows one decimal.",
    ...(store === "GOOGLE_PLAY"
      ? ["Google Play reports its own average, so read this as a rough guide."]
      : []),
    ...(count < THIN_SAMPLE_COUNT
      ? [
          `With fewer than ${THIN_SAMPLE_COUNT} ratings the average moves a lot with each new one.`,
        ]
      : []),
  ];
}

const shownTenths = (value: number): string =>
  formatTenths(displayedTenths(value));

function reachedNote(answer: MixAnswer, targetTenths: number): string {
  if (answer.kind !== "reaches") return "";
  return displayedTenths(answer.projected) > targetTenths
    ? ", above your target"
    : ", your target";
}

export function paceSentence(
  answer: MixAnswer,
  targetTenths: number,
  days: number,
): string {
  const target = formatTenths(targetTenths);
  if (answer.kind === "belowTarget") {
    return `Not at the current mix: new ratings average ${shownTenths(answer.newAverage)}, below ${target}.`;
  }
  const lead = `At your current pace the store shows ${shownTenths(answer.projected)} in ${pluralize(days, "day")}`;
  return `${lead}${reachedNote(answer, targetTenths)}.`;
}
