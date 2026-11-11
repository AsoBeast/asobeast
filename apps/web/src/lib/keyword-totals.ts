import type { TrackedKeywordItem } from "@asobeast/shared";
import { scoreValue } from "./keyword-scores";

export interface KeywordTotals {
  count: number;
  ranked: number;
  notFound: number;
  unchecked: number;
  averagePosition: number | null;
  topTen: number;
  averageOpportunity: number | null;
  averagePopularity: number | null;
  averageDifficulty: number | null;
  movedUp7d: number;
  movedDown7d: number;
}

export const TOP_TEN_MAX_POSITION = 10;

const mean = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const roundTo = (value: number | null, digits: number): number | null => {
  if (value === null) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const scored = (values: readonly (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null);

export function keywordTotals(
  rows: readonly TrackedKeywordItem[],
): KeywordTotals {
  const positions = scored(rows.map((row) => row.latestPosition));
  const unchecked = rows.filter((row) => row.latestDepth === null).length;
  const changes = scored(rows.map((row) => row.positionDelta7d));
  return {
    count: rows.length,
    ranked: positions.length,
    notFound: rows.length - positions.length - unchecked,
    unchecked,
    averagePosition: roundTo(mean(positions), 1),
    topTen: positions.filter((position) => position <= TOP_TEN_MAX_POSITION)
      .length,
    averageOpportunity: roundTo(
      mean(scored(rows.map((row) => scoreValue(row, "opportunity")))),
      0,
    ),
    averagePopularity: roundTo(
      mean(scored(rows.map((row) => scoreValue(row, "traffic")))),
      0,
    ),
    averageDifficulty: roundTo(
      mean(scored(rows.map((row) => scoreValue(row, "difficulty")))),
      0,
    ),
    movedUp7d: changes.filter((change) => change < 0).length,
    movedDown7d: changes.filter((change) => change > 0).length,
  };
}
