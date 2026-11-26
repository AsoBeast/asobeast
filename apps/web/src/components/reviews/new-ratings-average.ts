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

interface CountRead {
  date: string;
  count: number;
  average: number | null;
}

type RatedRead = CountRead & { average: number };

const isRated = (read: CountRead): read is RatedRead => read.average !== null;

function countReads(points: readonly RatingsPoint[]): CountRead[] {
  return points.flatMap(({ date, ratingAvg, ratingCount }) =>
    ratingCount === null
      ? []
      : [{ date, count: ratingCount, average: ratingAvg }],
  );
}

function segmentsOf(reads: readonly CountRead[]): CountRead[][] {
  const segments: CountRead[][] = [];
  reads.forEach((read, index) => {
    if (index === 0 || read.count < reads[index - 1].count) {
      segments.push([read]);
    } else {
      segments[segments.length - 1].push(read);
    }
  });
  return segments;
}

function pooledAverage(reads: readonly CountRead[]): NewRatingsAverage | null {
  let sum = 0;
  let added = 0;
  let error = 0;
  for (const segment of segmentsOf(reads)) {
    const rated = segment.filter(isRated);
    const start = rated[0];
    const end = rated[rated.length - 1];
    if (!start || end.count <= start.count) continue;
    sum += end.average * end.count - start.average * start.count;
    added += end.count - start.count;
    error += (start.count + end.count) * AVERAGE_ROUNDING;
  }
  if (added < NEW_RATINGS_MIN_ADDED) return null;
  if (error / added > NEW_RATINGS_MAX_ERROR) return null;
  const average = sum / added;
  if (average < LOWEST_STARS || average > HIGHEST_STARS) return null;
  const span =
    utcDayNumber(reads[reads.length - 1].date) - utcDayNumber(reads[0].date);
  return { average, added, span };
}

export function newRatingsAverage(
  points: readonly RatingsPoint[],
): NewRatingsAverage | null {
  return pooledAverage(countReads(points));
}

function windowAverage(window: readonly CountRead[]): number | null {
  if (segmentsOf(window).length > 1) return null;
  return pooledAverage(window)?.average ?? null;
}

export function newRatingsAverageSeries(
  points: readonly RatingsPoint[],
): NewRatingsAveragePoint[] {
  const reads = countReads(points);
  const first = reads[0];
  if (!first) return [];
  const firstFull = dayBefore(first.date, -NEW_RATINGS_WINDOW_DAYS);
  return reads.filter(isRated).map(({ date }) => {
    if (date < firstFull) return { date, average: null };
    const since = dayBefore(date, NEW_RATINGS_WINDOW_DAYS);
    const window = reads.filter(
      (read) => read.date >= since && read.date <= date,
    );
    return { date, average: windowAverage(window) };
  });
}
