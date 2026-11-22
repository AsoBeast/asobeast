import { VisibilityKeyword } from '@asobeast/shared';
import type { TrackedRow } from './analytics.support';
import { addDays, metricAt, Ranking, rankingAt } from './days';

const BASELINE_SHIFTS = [0, 1, -1] as const;
const CURRENT_SHIFTS = [0, -1] as const;

export type CheckLookup = (date: Date) => Ranking | null;

const checkWithin = (
  lookup: CheckLookup,
  target: Date,
  shifts: readonly number[],
): Ranking | null => {
  for (const shift of shifts) {
    const check = lookup(addDays(target, shift));
    if (check) {
      return check;
    }
  }
  return null;
};

const listLookup =
  (rankings: Ranking[]): CheckLookup =>
  (date) =>
    rankingAt(rankings, date);

export const baselineCheck = (rankings: Ranking[], target: Date) =>
  checkWithin(listLookup(rankings), target, BASELINE_SHIFTS);

export const currentCheckIn = (lookup: CheckLookup, reference: Date) =>
  checkWithin(lookup, reference, CURRENT_SHIFTS);

export const currentCheck = (rankings: Ranking[], reference: Date) =>
  currentCheckIn(listLookup(rankings), reference);

export const keywordOf = (
  row: TrackedRow,
  check: Ranking | null,
  target: Date,
): VisibilityKeyword => ({
  traffic:
    metricAt(row.keyword.metrics, check?.date ?? target)?.traffic ?? null,
  position: check?.position ?? null,
});

type CheckPick = (rankings: Ranking[], target: Date) => Ranking | null;

const keywordsWith = (
  rows: TrackedRow[],
  target: Date,
  pick: CheckPick,
): VisibilityKeyword[] =>
  rows.map((row) => keywordOf(row, pick(row.keyword.rankings, target), target));

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

export const checkedPositionsNow = (
  rows: TrackedRow[],
  reference: Date,
): Array<number | null> =>
  rows.flatMap((row) => {
    const check = currentCheck(row.keyword.rankings, reference);
    return check ? [check.position] : [];
  });
