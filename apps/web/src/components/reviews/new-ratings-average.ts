import type { RatingsPoint } from "@asobeast/shared";
import { dayBefore, utcDayNumber } from "@/lib/utc-day";

export const NEW_RATINGS_MIN_ADDED = 5;
export const NEW_RATINGS_MAX_ERROR = 0.05;
export const NEW_RATINGS_WINDOW_DAYS = 7;

const AVERAGE_ROUNDING = 5e-6;
const LOWEST_STARS = 1;
const HIGHEST_STARS = 5;

export interface NewRatingsAverage {
  average: number;
  added: number;
  span: number;
}

export interface NewRatingsAveragePoint {
  date: string;
  average: number | null;
}

interface RatedCount {
  date: string;
  count: number;
  average: number;
}

function ratedCounts(points: readonly RatingsPoint[]): RatedCount[] {
  return points.flatMap(({ date, ratingAvg, ratingCount }) =>
    ratingAvg === null || ratingCount === null
      ? []
      : [{ date, count: ratingCount, average: ratingAvg }],
  );
}

function segmentsOf(points: readonly RatedCount[]): RatedCount[][] {
  const segments: RatedCount[][] = [];
  points.forEach((point, index) => {
    if (index === 0 || point.count < points[index - 1].count) {
      segments.push([point]);
    } else {
      segments[segments.length - 1].push(point);
    }
  });
  return segments;
}

function pooledAverage(rated: readonly RatedCount[]): NewRatingsAverage | null {
  let sum = 0;
  let added = 0;
  let error = 0;
  for (const segment of segmentsOf(rated)) {
    const start = segment[0];
    const end = segment[segment.length - 1];
    if (end.count <= start.count) continue;
    sum += end.average * end.count - start.average * start.count;
    added += end.count - start.count;
    error += (start.count + end.count) * AVERAGE_ROUNDING;
  }
  if (added < NEW_RATINGS_MIN_ADDED) return null;
  if (error / added > NEW_RATINGS_MAX_ERROR) return null;
  const average = sum / added;
  if (average < LOWEST_STARS || average > HIGHEST_STARS) return null;
  const span =
    utcDayNumber(rated[rated.length - 1].date) - utcDayNumber(rated[0].date);
  return { average, added, span };
}

export function newRatingsAverage(
  points: readonly RatingsPoint[],
): NewRatingsAverage | null {
  return pooledAverage(ratedCounts(points));
}

function windowAverage(window: readonly RatedCount[]): number | null {
  if (segmentsOf(window).length > 1) return null;
  return pooledAverage(window)?.average ?? null;
}

export function newRatingsAverageSeries(
  points: readonly RatingsPoint[],
): NewRatingsAveragePoint[] {
  const rated = ratedCounts(points);
  const first = rated[0];
  if (!first) return [];
  const firstFull = dayBefore(first.date, -NEW_RATINGS_WINDOW_DAYS);
  return rated.map(({ date }) => {
    if (date < firstFull) return { date, average: null };
    const since = dayBefore(date, NEW_RATINGS_WINDOW_DAYS);
    const window = rated.filter(
      (point) => point.date >= since && point.date <= date,
    );
    return { date, average: windowAverage(window) };
  });
}
