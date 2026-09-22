import { clamp } from './curves';

type SearchPoint = readonly [volume: number, dailySearches: number];

export const OPPORTUNITY_HIGH = 35;
export const OPPORTUNITY_MIN_RELEVANCE = 60;
export const DAILY_SEARCHES_BY_VOLUME: SearchPoint[] = [
  [1, 1],
  [20, 35],
  [39, 65],
  [40, 70],
  [45, 140],
  [50, 280],
  [55, 570],
  [60, 1_150],
  [65, 2_300],
  [70, 4_600],
  [75, 9_300],
  [80, 19_000],
  [85, 38_000],
  [90, 76_000],
  [95, 152_000],
  [100, 300_000],
];
export const MAX_DAILY_SEARCHES = 300_000;

export function dailySearches(volume: number): number {
  if (volume <= 0) {
    return 0;
  }
  const [first] = DAILY_SEARCHES_BY_VOLUME;
  if (volume <= first[0]) {
    return first[1] * (volume / first[0]);
  }
  const index = DAILY_SEARCHES_BY_VOLUME.findIndex(
    ([threshold]) => volume <= threshold,
  );
  if (index === -1) {
    return MAX_DAILY_SEARCHES;
  }
  const [below, belowSearches] = DAILY_SEARCHES_BY_VOLUME[index - 1];
  const [above, aboveSearches] = DAILY_SEARCHES_BY_VOLUME[index];
  const ratio = (volume - below) / (above - below);
  return belowSearches + ratio * (aboveSearches - belowSearches);
}

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
  const reach =
    Math.log10(1 + dailySearches(volume)) / Math.log10(1 + MAX_DAILY_SEARCHES);
  const gate = 1 - (clamp(difficulty100, 0, 100) / 100) ** 2;
  return Math.trunc(clamp(reach * gate * 100, 0, 100));
}
