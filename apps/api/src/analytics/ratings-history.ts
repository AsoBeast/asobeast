import { RatingsPoint } from '@asobeast/shared';

export interface RatingSnapshotRow {
  ratingAvg: number | null;
  ratingCount: number | null;
  capturedAt: Date;
}

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

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
    .map(([date, row]) => ({
      date,
      ratingAvg: row.ratingAvg,
      ratingCount: row.ratingCount,
    }));
}
