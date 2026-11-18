import { VisibilityKeyword } from '@asobeast/shared';
import type { TrackedRow } from './analytics.support';
import { addDays, metricAt, Ranking, rankingAt } from './days';

const BASELINE_SHIFTS = [0, 1, -1] as const;

export function baselineCheck(
  rankings: Ranking[],
  target: Date,
): Ranking | null {
  for (const shift of BASELINE_SHIFTS) {
    const check = rankingAt(rankings, addDays(target, shift));
    if (check) {
      return check;
    }
  }
  return null;
}

const baselineOfRow = (row: TrackedRow, target: Date): Ranking | null =>
  baselineCheck(row.keyword.rankings, target);

export const hasBaseline = (rows: TrackedRow[], target: Date): boolean =>
  rows.some((row) => baselineOfRow(row, target) !== null);

export const baselinePositions = (
  rows: TrackedRow[],
  target: Date,
): Array<number | null> =>
  rows.map((row) => baselineOfRow(row, target)?.position ?? null);

export const keywordsAtBaseline = (
  rows: TrackedRow[],
  target: Date,
): VisibilityKeyword[] =>
  rows.map((row) => {
    const check = baselineOfRow(row, target);
    return {
      traffic:
        metricAt(row.keyword.metrics, check?.date ?? target)?.traffic ?? null,
      position: check?.position ?? null,
    };
  });
