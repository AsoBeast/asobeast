import { addUtcDays, utcDayOf } from '@asobeast/shared';

export const REVIEW_SPIKE_MIN = 5;
export const REVIEW_SPIKE_FACTOR = 3;
export const REVIEW_SPIKE_BASELINE_DAYS = 28;
export const REVIEW_SPIKE_MIN_HISTORY_DAYS = 7;
export const REVIEW_SPIKE_JUDGED_DAYS = 2;

export interface DayCount {
  count: number;
  low: number;
}

export interface SpikeInput {
  day: string;
  counts: ReadonlyMap<string, DayCount>;
  insertedOnDay: number;
  oldestDay: string | null;
}

export interface Spike {
  day: string;
  count: number;
  median: number;
  threshold: number;
  low: number;
}

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export const spikeThreshold = (median: number): number =>
  Math.max(REVIEW_SPIKE_MIN, REVIEW_SPIKE_FACTOR * median);

export function judgedDays(
  reviewedAt: readonly (Date | undefined)[],
  now: Date,
): string[] {
  const today = utcDayOf(now);
  const judged = new Set(
    Array.from({ length: REVIEW_SPIKE_JUDGED_DAYS }, (_, back) =>
      addUtcDays(today, -back),
    ),
  );
  const days = reviewedAt.flatMap((date) =>
    date && judged.has(utcDayOf(date)) ? [utcDayOf(date)] : [],
  );
  return [...new Set(days)].sort();
}

function baselineDays(day: string, oldestDay: string): string[] {
  return Array.from({ length: REVIEW_SPIKE_BASELINE_DAYS }, (_, back) =>
    addUtcDays(day, -(back + 1)),
  ).filter((baseline) => baseline >= oldestDay);
}

export function judgeSpike(input: SpikeInput): Spike | null {
  if (input.oldestDay === null) return null;
  const baseline = baselineDays(input.day, input.oldestDay);
  if (baseline.length < REVIEW_SPIKE_MIN_HISTORY_DAYS) return null;
  const median = medianOf(
    baseline.map((day) => input.counts.get(day)?.count ?? 0),
  );
  const threshold = spikeThreshold(median);
  const { count = 0, low = 0 } = input.counts.get(input.day) ?? {};
  const crossed = count > threshold && count - input.insertedOnDay <= threshold;
  return crossed ? { day: input.day, count, median, threshold, low } : null;
}
