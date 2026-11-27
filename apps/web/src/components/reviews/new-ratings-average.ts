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

interface Read {
  date: string;
  count: number;
  sum: number | null;
  rounding: number;
}

type SummedRead = Read & { sum: number };

const hasSum = (read: Read): read is SummedRead => read.sum !== null;

function impliedReads(points: readonly RatingsPoint[]): Read[] {
  return points.flatMap(({ date, ratingAvg, ratingCount }) =>
    ratingCount === null
      ? []
      : [
          {
            date,
            count: ratingCount,
            sum: ratingAvg === null ? null : ratingAvg * ratingCount,
            rounding: ratingCount * AVERAGE_ROUNDING,
          },
        ],
  );
}

function segmentsOf(reads: readonly Read[]): Read[][] {
  const segments: Read[][] = [];
  reads.forEach((read, index) => {
    if (index === 0 || read.count < reads[index - 1].count) {
      segments.push([read]);
    } else {
      segments[segments.length - 1].push(read);
    }
  });
  return segments;
}

function pooledAverage(reads: readonly Read[]): NewRatingsAverage | null {
  let sum = 0;
  let added = 0;
  let error = 0;
  for (const segment of segmentsOf(reads)) {
    const summed = segment.filter(hasSum);
    const start = summed[0];
    const end = summed[summed.length - 1];
    if (!start || end.count <= start.count) continue;
    sum += end.sum - start.sum;
    added += end.count - start.count;
    error += start.rounding + end.rounding;
  }
  if (added < NEW_RATINGS_MIN_ADDED) return null;
  if (error / added > NEW_RATINGS_MAX_ERROR) return null;
  const average = sum / added;
  if (average < LOWEST_STARS || average > HIGHEST_STARS) return null;
  const span =
    utcDayNumber(reads[reads.length - 1].date) - utcDayNumber(reads[0].date);
  return { average, added, span };
}

function windowAverage(window: readonly Read[]): number | null {
  if (segmentsOf(window).length > 1) return null;
  return pooledAverage(window)?.average ?? null;
}

function seriesOf(reads: readonly Read[]): NewRatingsAveragePoint[] {
  const first = reads[0];
  if (!first) return [];
  const firstFull = dayBefore(first.date, -NEW_RATINGS_WINDOW_DAYS);
  return reads.filter(hasSum).map(({ date }) => {
    if (date < firstFull) return { date, average: null };
    const since = dayBefore(date, NEW_RATINGS_WINDOW_DAYS);
    const window = reads.filter(
      (read) => read.date >= since && read.date <= date,
    );
    return { date, average: windowAverage(window) };
  });
}

export function newRatingsAverage(
  points: readonly RatingsPoint[],
): NewRatingsAverage | null {
  return pooledAverage(impliedReads(points));
}

export function newRatingsAverageSeries(
  points: readonly RatingsPoint[],
): NewRatingsAveragePoint[] {
  return seriesOf(impliedReads(points));
}
