import { RATING_STARS, type RatingsPoint, type Store } from "@asobeast/shared";
import { dayBefore, utcDayNumber } from "@/lib/utc-day";

export const NEW_RATINGS_MIN_ADDED = 5;
export const NEW_RATINGS_MAX_ERROR = 0.05;
export const NEW_RATINGS_WINDOW_DAYS = 7;

const AVERAGE_ROUNDING = 5e-6;
const EXACT_COUNTS_ROUNDING = 0;
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

function windowEndingOn(
  reads: readonly Read[],
  date: string,
): readonly Read[] | null {
  const since = dayBefore(date, NEW_RATINGS_WINDOW_DAYS);
  const baseline = reads
    .filter((read) => hasSum(read) && read.date <= since)
    .at(-1);
  return baseline
    ? reads.filter((read) => read.date >= baseline.date && read.date <= date)
    : null;
}

function seriesOf(reads: readonly Read[]): NewRatingsAveragePoint[] {
  return reads.filter(hasSum).map(({ date }) => {
    const window = windowEndingOn(reads, date);
    return { date, average: window ? windowAverage(window) : null };
  });
}

function starReads(points: readonly RatingsPoint[]): Read[] {
  return points.flatMap(({ date, starCounts }) => {
    if (!starCounts) return [];
    let count = 0;
    let sum = 0;
    for (const star of RATING_STARS) {
      count += starCounts[star];
      sum += Number(star) * starCounts[star];
    }
    return [{ date, count, sum, rounding: EXACT_COUNTS_ROUNDING }];
  });
}

const readsOf = (store: Store, points: readonly RatingsPoint[]): Read[] =>
  store === "GOOGLE_PLAY" ? starReads(points) : impliedReads(points);

export function newRatingsAverageFor(
  store: Store,
  points: readonly RatingsPoint[],
): NewRatingsAverage | null {
  return pooledAverage(readsOf(store, points));
}

export function newRatingsAverageSeriesFor(
  store: Store,
  points: readonly RatingsPoint[],
): NewRatingsAveragePoint[] {
  return seriesOf(readsOf(store, points));
}

export const newRatingsAverage = (
  points: readonly RatingsPoint[],
): NewRatingsAverage | null => newRatingsAverageFor("APP_STORE", points);

export const newRatingsAverageSeries = (
  points: readonly RatingsPoint[],
): NewRatingsAveragePoint[] => newRatingsAverageSeriesFor("APP_STORE", points);

export const hasStarCountReads = (points: readonly RatingsPoint[]): boolean =>
  starReads(points).length > 1;
