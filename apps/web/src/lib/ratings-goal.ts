export const MAX_TARGET_TENTHS = 50;
export const MIN_TARGET_TENTHS = 1;
export const THIN_SAMPLE_COUNT = 20;
export const DEFAULT_GOAL_DAYS = 30;
export const MAX_GOAL_DAYS = 365;

const ROUNDING_TOLERANCE = 1e-9;

export type RatingsGoal =
  { kind: "reached" } | { kind: "needed"; ratings: number; perDay: number };

export function displayedTenths(average: number): number {
  return Math.floor(average * 10 + 0.5 + ROUNDING_TOLERANCE);
}

export function displayedRating(average: number): number {
  return displayedTenths(average) / 10;
}

export function defaultTargetTenths(average: number): number {
  return Math.min(MAX_TARGET_TENTHS, displayedTenths(average) + 1);
}

export function parseTargetTenths(text: string): number | null {
  const value = Number(text);
  if (text.trim() === "" || !Number.isFinite(value)) return null;
  if (
    value < MIN_TARGET_TENTHS / 10 - ROUNDING_TOLERANCE ||
    value > MAX_TARGET_TENTHS / 10 + ROUNDING_TOLERANCE
  ) {
    return null;
  }
  return Math.round(value * 10);
}

export function parseGoalDays(text: string): number | null {
  const value = Number(text);
  if (text.trim() === "" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= MAX_GOAL_DAYS ? value : null;
}

export function fiveStarRatingsToReach(
  average: number,
  count: number,
  targetTenths: number,
  days: number,
): RatingsGoal {
  if (displayedTenths(average) >= targetTenths) return { kind: "reached" };
  const shown = targetTenths / 10 - 0.05;
  const raw = count === 0 ? 1 : (count * (shown - average)) / (5 - shown);
  const ratings = Math.max(1, Math.ceil(raw - ROUNDING_TOLERANCE));
  return { kind: "needed", ratings, perDay: Math.ceil(ratings / days) };
}
