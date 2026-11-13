import type { RatingsPoint } from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";

export interface NewRatingsPoint {
  date: string;
  added: number;
}

interface CountedPoint {
  date: string;
  count: number;
}

const BASELINE_SLACK_DAYS = 3;

function countedPoints(points: readonly RatingsPoint[]): CountedPoint[] {
  return points.flatMap((point) =>
    point.ratingCount === null
      ? []
      : [{ date: point.date, count: point.ratingCount }],
  );
}

export function latestRatingCount(
  points: readonly RatingsPoint[],
): number | null {
  return countedPoints(points).at(-1)?.count ?? null;
}

export function newRatings(points: readonly RatingsPoint[]): NewRatingsPoint[] {
  const counted = countedPoints(points);
  return counted.slice(1).map((point, index) => ({
    date: point.date,
    added: Math.max(0, point.count - counted[index].count),
  }));
}

export function ratingsAdded(
  points: readonly RatingsPoint[],
  days: number,
): number | null {
  const counted = countedPoints(points);
  const latest = counted.at(-1);
  if (!latest) return null;
  const since = dayBefore(latest.date, days);
  const oldest = dayBefore(since, BASELINE_SLACK_DAYS);
  const before = counted.findLast(
    (point) => point.date <= since && point.date >= oldest,
  );
  return before ? latest.count - before.count : null;
}

export function ratingsGrowth(
  points: readonly RatingsPoint[],
): { added: number; since: string } | null {
  const counted = countedPoints(points);
  const latest = counted.at(-1);
  if (!latest || counted.length < 2) return null;
  return { added: latest.count - counted[0].count, since: counted[0].date };
}
