export const MIN_TARGET_TENTHS = 1;
export const MAX_TARGET_TENTHS = 50;
export const THIN_SAMPLE_COUNT = 20;
export const DEFAULT_GOAL_DAYS = 30;
export const MIN_GOAL_DAYS = 1;
export const MAX_GOAL_DAYS = 365;

const ROUNDING_TOLERANCE = 1e-9;
const TARGET_PATTERN = /^(\d+|\d*\.\d0*)$/;
const DAYS_PATTERN = /^\d+$/;

export type GoalPace =
  { kind: "daily"; ratings: number } | { kind: "every"; days: number };

export type RatingsGoal =
  | { kind: "first" }
  | { kind: "reached" }
  | { kind: "needed"; ratings: number; pace: GoalPace };

export function displayedTenths(average: number): number {
  return Math.floor(average * 10 + 0.5 + ROUNDING_TOLERANCE);
}

export function defaultTargetTenths(average: number, count: number): number {
  if (count === 0) return MAX_TARGET_TENTHS;
  return Math.min(MAX_TARGET_TENTHS, displayedTenths(average) + 1);
}

export function parseTargetTenths(text: string): number | null {
  const trimmed = text.trim();
  if (!TARGET_PATTERN.test(trimmed)) return null;
  const tenths = Math.round(Number(trimmed) * 10);
  return tenths >= MIN_TARGET_TENTHS && tenths <= MAX_TARGET_TENTHS
    ? tenths
    : null;
}

export function parseGoalDays(text: string): number | null {
  const trimmed = text.trim();
  if (!DAYS_PATTERN.test(trimmed)) return null;
  const days = Number(trimmed);
  return days >= MIN_GOAL_DAYS && days <= MAX_GOAL_DAYS ? days : null;
}

export function goalPace(ratings: number, days: number): GoalPace {
  const daysPerRating = Math.floor(days / ratings);
  return daysPerRating >= 2
    ? { kind: "every", days: daysPerRating }
    : { kind: "daily", ratings: Math.ceil(ratings / days) };
}

function showsTarget(
  average: number,
  count: number,
  ratings: number,
  targetTenths: number,
): boolean {
  const lifted = (average * count + 5 * ratings) / (count + ratings);
  return displayedTenths(lifted) >= targetTenths;
}

function smallestRatingsToShow(
  average: number,
  count: number,
  targetTenths: number,
): number {
  const boundary = targetTenths / 10 - 0.05;
  const estimate = (count * (boundary - average)) / (5 - boundary);
  let ratings = Math.max(1, Math.ceil(estimate));
  while (
    ratings > 1 &&
    showsTarget(average, count, ratings - 1, targetTenths)
  ) {
    ratings -= 1;
  }
  while (!showsTarget(average, count, ratings, targetTenths)) ratings += 1;
  return ratings;
}

export function fiveStarRatingsToReach(
  average: number,
  count: number,
  targetTenths: number,
  days: number,
): RatingsGoal {
  if (count === 0) return { kind: "first" };
  if (displayedTenths(average) >= targetTenths) return { kind: "reached" };
  const ratings = smallestRatingsToShow(average, count, targetTenths);
  return { kind: "needed", ratings, pace: goalPace(ratings, days) };
}
