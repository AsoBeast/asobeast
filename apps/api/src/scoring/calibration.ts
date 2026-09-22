import {
  CURRENT_FORMULA_VERSIONS,
  SerpFlag,
  SuggestReachStatus,
} from '@asobeast/shared';
import { readScoreSignals } from './score-signals';

export const CALIBRATION_MIN_PAIRS = 10;
export const CALIBRATION_LARGEST = 10;
const DISPLAY_SCALE = 10;

export interface CalibrationPair {
  keyword: string;
  estimated: number;
  official: number;
  reach: SuggestReachStatus;
  flags: SerpFlag[];
}

export interface CalibrationRow {
  text: string;
  formulaVersion: string | null;
  stats: unknown;
}

export type CalibrationReport =
  | { status: 'not_enough_data'; pairs: number }
  | {
      status: 'ok';
      pairs: number;
      spearman: number;
      meanAbsoluteError: number;
      meanSignedError: number;
      largest: Array<CalibrationPair & { error: number }>;
    };

function ranks(values: number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (
      end + 1 < order.length &&
      order[end + 1].value === order[start].value
    ) {
      end += 1;
    }
    const meanRank = (start + end) / 2 + 1;
    for (let position = start; position <= end; position += 1) {
      result[order[position].index] = meanRank;
    }
    start = end + 1;
  }
  return result;
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export function spearman(left: number[], right: number[]): number {
  const a = ranks(left);
  const b = ranks(right);
  const meanA = mean(a);
  const meanB = mean(b);
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  a.forEach((rank, index) => {
    covariance += (rank - meanA) * (b[index] - meanB);
    varianceA += (rank - meanA) ** 2;
    varianceB += (b[index] - meanB) ** 2;
  });
  return varianceA === 0 || varianceB === 0
    ? 0
    : covariance / Math.sqrt(varianceA * varianceB);
}

export function calibrationReport(pairs: CalibrationPair[]): CalibrationReport {
  if (pairs.length < CALIBRATION_MIN_PAIRS) {
    return { status: 'not_enough_data', pairs: pairs.length };
  }
  const withError = pairs.map((pair) => ({
    ...pair,
    error: pair.estimated * DISPLAY_SCALE - pair.official,
  }));
  return {
    status: 'ok',
    pairs: pairs.length,
    spearman: spearman(
      pairs.map((pair) => pair.estimated),
      pairs.map((pair) => pair.official),
    ),
    meanAbsoluteError: mean(withError.map((pair) => Math.abs(pair.error))),
    meanSignedError: mean(withError.map((pair) => pair.error)),
    largest: [...withError]
      .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
      .slice(0, CALIBRATION_LARGEST),
  };
}

export function calibrationPairs(rows: CalibrationRow[]): CalibrationPair[] {
  return rows.flatMap((row) => {
    const signals = readScoreSignals(row.stats);
    if (
      row.formulaVersion !== CURRENT_FORMULA_VERSIONS.APP_STORE ||
      !signals ||
      signals.officialPopularity === null ||
      signals.estimatedTraffic === null
    ) {
      return [];
    }
    return [
      {
        keyword: row.text,
        estimated: signals.estimatedTraffic,
        official: signals.officialPopularity,
        reach: signals.suggestReach,
        flags: signals.flags,
      },
    ];
  });
}
