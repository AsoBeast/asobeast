import { RATING_STARS, RatingCounts, RatingsPoint } from '@asobeast/shared';
import { ratingCountsOf } from '../store-providers/raw-facts';

export interface RatingSnapshotRow {
  ratingAvg: number | null;
  ratingCount: number | null;
  ratingHistogram: unknown;
  capturedAt: Date;
}

const STAR_TOTAL_TOLERANCE_PERCENT = 2;
const PERCENT = 100;

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

export function consistentStarCounts(
  counts: RatingCounts | null,
  ratingCount: number | null,
): RatingCounts | null {
  if (!counts || !ratingCount) {
    return null;
  }
  const total = RATING_STARS.reduce((sum, star) => sum + counts[star], 0);
  return total > 0 &&
    Math.abs(total - ratingCount) * PERCENT <=
      ratingCount * STAR_TOTAL_TOLERANCE_PERCENT
    ? counts
    : null;
}

export function collapseRatings(rows: RatingSnapshotRow[]): RatingsPoint[] {
  const byDay = new Map<string, RatingSnapshotRow>();
  for (const row of rows) {
    const key = toDateKey(row.capturedAt);
    const existing = byDay.get(key);
    if (!existing || row.capturedAt.getTime() > existing.capturedAt.getTime()) {
      byDay.set(key, row);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => {
      const starCounts = consistentStarCounts(
        ratingCountsOf(row.ratingHistogram),
        row.ratingCount,
      );
      return {
        date,
        ratingAvg: row.ratingAvg,
        ratingCount: row.ratingCount,
        ...(starCounts ? { starCounts } : {}),
      };
    });
}
