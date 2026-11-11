import type { RatingsPoint } from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";

export const RATING_CHANGE_DAYS = 7;

export const RATING_CHANGE_RANGE = "30d";

const BASELINE_SLACK_DAYS = 3;

const AXIS_STEP = 0.1;
const MAX_RATING = 5;

export interface RatedPoint {
  date: string;
  ratingAvg: number;
  ratingCount: number | null;
}

export function ratedPoints(points: readonly RatingsPoint[]): RatedPoint[] {
  return points.flatMap((point) =>
    point.ratingAvg === null ? [] : [{ ...point, ratingAvg: point.ratingAvg }],
  );
}

export function ratingChange(
  points: readonly RatingsPoint[],
  days: number,
): number | null {
  const rated = ratedPoints(points);
  const latest = rated.at(-1);
  if (!latest) return null;
  const since = dayBefore(latest.date, days);
  const oldest = dayBefore(since, BASELINE_SLACK_DAYS);
  const before = rated.findLast(
    (point) => point.date <= since && point.date >= oldest,
  );
  return before ? latest.ratingAvg - before.ratingAvg : null;
}

export function ratingAxis(points: readonly RatedPoint[]): [number, number] {
  const values = points.map((point) => point.ratingAvg);
  const steps = (value: number) => Math.round(value / AXIS_STEP);
  return [
    Math.max(0, (steps(Math.min(...values)) - 1) * AXIS_STEP),
    Math.min(MAX_RATING, (steps(Math.max(...values)) + 1) * AXIS_STEP),
  ];
}
