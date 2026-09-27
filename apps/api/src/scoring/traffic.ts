import { Store } from '@asobeast/shared';
import { clamp, finiteNumbers, logScale, median } from './curves';
import { KeywordStats } from './formulas';
import { estimatePopularity, NEUTRAL_CONTINUATIONS } from './popularity-model';
import { paddingFactor } from './serp-signals';
import { reachScore } from './suggest-reach';

export const DEMAND_WEIGHT = 0.12;
export const TYPICAL_REACH = 2.5;
export const DEMAND_BOUNDS: Record<Store, readonly [number, number]> = {
  APP_STORE: [50, 500_000],
  GOOGLE_PLAY: [100, 2_000_000],
};
export const ABSENT_TRAFFIC_CAP = 1.5;
export const THIN_SERP_RESULTS = 5;
export const THIN_SERP_TRAFFIC_CAP = 1;
const POPULARITY_SCALE = 10;
const TRAFFIC_MAX = 10;

export function demandScore(stats: KeywordStats): number {
  const [min, max] = DEMAND_BOUNDS[stats.store];
  const typical = median(
    finiteNumbers(stats.top10.map((item) => item.ratingCount)),
  );
  return (
    logScale(typical, min, max) * paddingFactor(stats.top10, stats.keywordText)
  );
}

function suggestEstimate(stats: KeywordStats): number {
  const reach = reachScore(stats.suggest) ?? TYPICAL_REACH;
  const blend = reach + DEMAND_WEIGHT * demandScore(stats);
  const cap = stats.suggest.status === 'absent' ? ABSENT_TRAFFIC_CAP : 10;
  return clamp(Math.min(blend, cap));
}

function modelEstimate(stats: KeywordStats): number {
  const popularity = estimatePopularity(
    stats.competitors ?? stats.top10,
    stats.keywordText,
    {
      continuations: stats.continuations ?? NEUTRAL_CONTINUATIONS,
      reach: stats.suggest,
    },
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
  return official ? belowListed(estimate, official.absentBelow) : estimate;
}

function belowListed(estimate: number, absentBelow: number): number {
  const ceiling = Math.max(
    (absentBelow - 1) / POPULARITY_SCALE,
    ABSENT_TRAFFIC_CAP,
  );
  return (clamp(estimate) * ceiling) / TRAFFIC_MAX;
}
