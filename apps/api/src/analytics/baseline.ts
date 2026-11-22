import { VisibilityKeyword } from '@asobeast/shared';
import type { TrackedRow } from './analytics.support';
import { addDays, metricAt, Ranking, rankingAt } from './days';

const BASELINE_SHIFTS = [0, 1, -1] as const;
const CURRENT_SHIFTS = [0, -1] as const;

const checkWithin = (
  rankings: Ranking[],
  target: Date,
  shifts: readonly number[],
): Ranking | null => {
  for (const shift of shifts) {
    const check = rankingAt(rankings, addDays(target, shift));
    if (check) {
      return check;
    }
  }
  return null;
};

export const baselineCheck = (rankings: Ranking[], target: Date) =>
  checkWithin(rankings, target, BASELINE_SHIFTS);

export const currentCheck = (rankings: Ranking[], reference: Date) =>
  checkWithin(rankings, reference, CURRENT_SHIFTS);

type CheckPick = (rankings: Ranking[], target: Date) => Ranking | null;

const keywordsWith = (
  rows: TrackedRow[],
  target: Date,
  pick: CheckPick,
): VisibilityKeyword[] =>
  rows.map((row) => {
    const check = pick(row.keyword.rankings, target);
    return {
      traffic:
        metricAt(row.keyword.metrics, check?.date ?? target)?.traffic ?? null,
      position: check?.position ?? null,
    };
  });

const positionsWith = (
  rows: TrackedRow[],
  target: Date,
  pick: CheckPick,
): Array<number | null> =>
  rows.map((row) => pick(row.keyword.rankings, target)?.position ?? null);

export const hasBaseline = (rows: TrackedRow[], target: Date): boolean =>
  rows.some((row) => baselineCheck(row.keyword.rankings, target) !== null);

export const baselinePositions = (rows: TrackedRow[], target: Date) =>
  positionsWith(rows, target, baselineCheck);

export const keywordsAtBaseline = (rows: TrackedRow[], target: Date) =>
  keywordsWith(rows, target, baselineCheck);

export const positionsNow = (rows: TrackedRow[], reference: Date) =>
  positionsWith(rows, reference, currentCheck);

export const keywordsNow = (rows: TrackedRow[], reference: Date) =>
  keywordsWith(rows, reference, currentCheck);
