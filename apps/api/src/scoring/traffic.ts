import { clamp } from './curves';
import { pageStrength, targetingShare } from './difficulty';
import { KeywordStats } from './formulas';
import {
  estimatePopularity,
  NEUTRAL_CONTINUATIONS,
  POPULARITY_WEIGHTS,
  PopularityWeights,
  UNLISTED_POPULARITY_WEIGHTS,
} from './popularity-model';
import { reachScore, untypedShare } from './suggest-reach';

export const SUGGEST_WEIGHTS = {
  reach: 0.5,
  untyped: 1.5,
  strength: 1.1,
  targeting: 1.9,
} as const;
export const TYPICAL_REACH = 2.5;
export const TYPICAL_UNTYPED = 0.4;
export const ABSENT_TRAFFIC_CAP = 1.5;
export const THIN_SERP_RESULTS = 5;
export const THIN_SERP_TRAFFIC_CAP = 1;
const POPULARITY_SCALE = 10;

function suggestEstimate(stats: KeywordStats): number {
  const reach = reachScore(stats.suggest) ?? TYPICAL_REACH;
  const untyped =
    untypedShare(stats.suggest, stats.keywordText) ?? TYPICAL_UNTYPED;
  const blend =
    SUGGEST_WEIGHTS.reach * reach +
    SUGGEST_WEIGHTS.untyped * untyped +
    SUGGEST_WEIGHTS.strength * pageStrength(stats.top10) +
    SUGGEST_WEIGHTS.targeting * targetingShare(stats.top10, stats.keywordText);
  const cap = stats.suggest.status === 'absent' ? ABSENT_TRAFFIC_CAP : 10;
  return clamp(Math.min(blend, cap));
}

function modelEstimate(
  stats: KeywordStats,
  weights: PopularityWeights,
): number {
  const popularity = estimatePopularity(
    stats.competitors ?? stats.top10,
    stats.keywordText,
    {
      continuations: stats.continuations ?? NEUTRAL_CONTINUATIONS,
      reach: stats.suggest,
    },
    weights,
  );
  return popularity === null ? 0 : popularity / POPULARITY_SCALE;
}

const weightsFor = ({ official }: KeywordStats): PopularityWeights =>
  official && 'absentBelow' in official
    ? UNLISTED_POPULARITY_WEIGHTS
    : POPULARITY_WEIGHTS;

export function estimateTraffic(stats: KeywordStats): number {
  if (stats.resultCount === 0) {
    return 0;
  }
  const estimate =
    stats.store === 'APP_STORE'
      ? modelEstimate(stats, weightsFor(stats))
      : suggestEstimate(stats);
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
