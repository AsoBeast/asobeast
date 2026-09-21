import { clamp } from './curves';

export const OPPORTUNITY_HIGH = 35;
export const CHANCE_MAX_SHIFT = 15;
export const CHANCE_LOG_RANGE = 2;

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function computeOpportunity(
  volume: number | null,
  difficulty100: number | null,
  relevance: number,
  shift = 0,
): number | null {
  if (volume === null || difficulty100 === null) {
    return null;
  }
  if (![volume, difficulty100, relevance, shift].every(Number.isFinite)) {
    return null;
  }
  const gate = 1 - (clamp(difficulty100 + shift, 0, 100) / 100) ** 2;
  const fit = clamp(relevance, 0, 100) / 100;
  return round1(clamp(volume * gate * fit, 0, 100));
}

export function chanceShift(
  appRatingCount: number | null,
  medianTopTenRatings: number | null,
): number {
  if (appRatingCount === null || medianTopTenRatings === null) {
    return 0;
  }
  const gap =
    Math.log10(Math.max(medianTopTenRatings, 1)) -
    Math.log10(Math.max(appRatingCount, 1));
  return (
    clamp(gap, -CHANCE_LOG_RANGE, CHANCE_LOG_RANGE) *
    (CHANCE_MAX_SHIFT / CHANCE_LOG_RANGE)
  );
}
