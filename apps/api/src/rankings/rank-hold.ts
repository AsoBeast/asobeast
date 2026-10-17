import { isRanked, tierOf } from '@asobeast/shared';

export interface HeldRanking {
  position: number | null;
  date: Date;
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

export function daysInTier(rankings: HeldRanking[]): number | null {
  const latest = rankings[0];
  if (!latest) {
    return null;
  }
  const tier = tierOf(latest.position);
  if (tier === null) {
    return null;
  }
  const expected = new Date(latest.date);
  let held = 0;
  for (const ranking of rankings) {
    if (dayKey(ranking.date) !== dayKey(expected)) {
      break;
    }
    if (!isRanked(ranking.position) || ranking.position > tier) {
      break;
    }
    held += 1;
    expected.setUTCDate(expected.getUTCDate() - 1);
  }
  return held;
}
