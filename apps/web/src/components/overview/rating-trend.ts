import type { RatingsPoint } from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";

export const RATING_CHANGE_DAYS = 7;

export const RATING_CHANGE_RANGE = "30d";

const BASELINE_SLACK_DAYS = 3;

const TENTHS = 10;
const MAX_TENTHS = 5 * TENTHS;
const MAX_TICKS = 6;
const TICK_STEPS = [1, 2, 5, TENTHS];

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

export interface RatingAxis {
  domain: [number, number];
  ticks: number[];
}

const tenthsOf = (value: number): number => Math.round(value * TENTHS);

const tickCount = (low: number, high: number, step: number): number =>
  Math.ceil(high / step) - Math.floor(low / step) + 1;

export function ratingAxis(points: readonly RatedPoint[]): RatingAxis {
  const values = points.map((point) => point.ratingAvg);
  const low = Math.max(0, tenthsOf(Math.min(...values)) - 1);
  const high = Math.min(MAX_TENTHS, tenthsOf(Math.max(...values)) + 1);
  const step =
    TICK_STEPS.find((each) => tickCount(low, high, each) <= MAX_TICKS) ??
    TENTHS;
  const from = Math.floor(low / step) * step;
  const to = Math.ceil(high / step) * step;
  const ticks = Array.from(
    { length: (to - from) / step + 1 },
    (_, index) => (from + index * step) / TENTHS,
  );
  return { domain: [from / TENTHS, to / TENTHS], ticks };
}
