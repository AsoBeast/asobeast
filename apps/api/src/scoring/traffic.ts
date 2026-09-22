import { searchKey, Store } from '@asobeast/shared';
import { clamp, finiteNumbers, logScale, median } from './curves';
import { KeywordStats } from './formulas';
import { estimatePopularity } from './popularity-model';
import { paddingFactor } from './serp-signals';
import { reachScore } from './suggest-reach';

export const TRAFFIC_WEIGHTS = { reach: 0.65, demand: 0.35 } as const;
export const DEMAND_ONLY_FACTOR = 0.7;
export const DEMAND_BOUNDS: Record<Store, readonly [number, number]> = {
  APP_STORE: [50, 500_000],
  GOOGLE_PLAY: [100, 2_000_000],
};
export const WORD_FACTORS = [1, 1, 0.92, 0.8, 0.65, 0.5] as const;
export const ABSENT_TRAFFIC_CAP = 1.5;
export const THIN_SERP_RESULTS = 5;
export const THIN_SERP_TRAFFIC_CAP = 1;
const POPULARITY_SCALE = 10;

export function demandScore(stats: KeywordStats): number {
  const [min, max] = DEMAND_BOUNDS[stats.store];
  const typical = median(
    finiteNumbers(stats.top10.map((item) => item.ratingCount)),
  );
  return (
    logScale(typical, min, max) * paddingFactor(stats.top10, stats.keywordText)
  );
}

function wordFactor(keywordText: string): number {
  const words = searchKey(keywordText).split(' ').filter(Boolean).length;
  return WORD_FACTORS[Math.min(words, WORD_FACTORS.length - 1)];
}

function suggestEstimate(stats: KeywordStats): number {
  const reach = reachScore(stats.suggest);
  const demand = demandScore(stats);
  const blend =
    reach === null
      ? DEMAND_ONLY_FACTOR * demand
      : TRAFFIC_WEIGHTS.reach * reach + TRAFFIC_WEIGHTS.demand * demand;
  const cap = stats.suggest.status === 'absent' ? ABSENT_TRAFFIC_CAP : 10;
  return clamp(Math.min(blend * wordFactor(stats.keywordText), cap));
}

function modelEstimate(stats: KeywordStats): number {
  const popularity = estimatePopularity(
    stats.competitors ?? stats.top10,
    stats.keywordText,
  );
  return popularity === null ? 0 : popularity / POPULARITY_SCALE;
}

export function estimateTraffic(stats: KeywordStats): number {
  if (stats.resultCount === 0) {
    return 0;
  }
  const estimate =
    stats.store === 'APP_STORE' ? modelEstimate(stats) : suggestEstimate(stats);
  return stats.resultCount < THIN_SERP_RESULTS
    ? Math.min(estimate, THIN_SERP_TRAFFIC_CAP)
    : estimate;
}

export function computeTraffic(stats: KeywordStats): number {
  const { official } = stats;
  if (official && 'value' in official) {
    return clamp(official.value / POPULARITY_SCALE);
  }
  const estimate = estimateTraffic(stats);
  return official
    ? Math.min(
        estimate,
        Math.max(
          (official.absentBelow - 1) / POPULARITY_SCALE,
          ABSENT_TRAFFIC_CAP,
        ),
      )
    : estimate;
}
