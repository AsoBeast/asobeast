import { clamp } from './curves';

export const OPPORTUNITY_HIGH = 35;
export const OPPORTUNITY_MIN_RELEVANCE = 60;
export const SUFFICIENT_VOLUME = 30;
export const REACH_CURVE = 1.25;

export function computeOpportunity(
  volume: number | null,
  difficulty100: number | null,
): number | null {
  if (volume === null || difficulty100 === null) {
    return null;
  }
  if (![volume, difficulty100].every(Number.isFinite)) {
    return null;
  }
  const reach = clamp(volume / SUFFICIENT_VOLUME, 0, 1) ** REACH_CURVE;
  const openness = 100 - clamp(difficulty100, 0, 100);
  return Math.trunc(reach * openness);
}
