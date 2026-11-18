import { addDays, Ranking, rankingAt } from './days';

export const BASELINE_SHIFTS = [0, 1, -1] as const;

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
