import { clamp, finiteNumbers, logScale, median } from './curves';
import { KeywordStats } from './formulas';
import { serpFlags } from './serp-flags';
import { paddingFactor, serpRelevance } from './serp-signals';

export const DIFFICULTY_WEIGHTS = {
  strength: 0.4,
  dominance: 0.2,
  targeting: 0.2,
  freshness: 0.1,
  depth: 0.1,
} as const;
export const STRENGTH_BOUNDS = [100, 1_000_000] as const;
export const DOMINANCE_LOG_CEILING = 7;
export const DOMINANCE_TOP = 5;
export const DOMINANCE_TOP_WEIGHT = 2;
export const PADDED_DISCOUNT_FLOOR = 0.5;
export const BRAND_DIFFICULTY_FLOOR = 8.5;
export const WEAK_LEADER_DIFFICULTY_CAP = 3.5;
export const SMALL_SERP_DIFFICULTY_CAP = 2;
export const VELOCITY_WEIGHT = 0.1;
export const VELOCITY_BOUNDS = [10, 50_000] as const;
export const VELOCITY_MIN_DAYS = 14;
export const VELOCITY_MIN_APPS = 3;
const DAYS_PER_MONTH = 30;

const average = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

export const competitorsScore = (stats: KeywordStats): number =>
  clamp(stats.top30TitleMatchCount / 3);

export const freshnessScore = (stats: KeywordStats): number => {
  const days = finiteNumbers(stats.top10.map((item) => item.daysSinceUpdate));
  return days.length === 0 ? 0 : clamp(10 - average(days) / 9);
};

export const strengthScore = (stats: KeywordStats): number =>
  logScale(
    median(finiteNumbers(stats.top10.map((item) => item.ratingCount))),
    ...STRENGTH_BOUNDS,
  );

export function dominanceScore(stats: KeywordStats): number {
  let weighted = 0;
  let weights = 0;
  stats.top10.forEach((item, index) => {
    const [count] = finiteNumbers([item.ratingCount]);
    if (count === undefined) {
      return;
    }
    const weight = index < DOMINANCE_TOP ? DOMINANCE_TOP_WEIGHT : 1;
    weighted +=
      weight *
      Math.min(1, Math.log10(Math.max(count, 1)) / DOMINANCE_LOG_CEILING);
    weights += weight;
  });
  return weights === 0 ? 0 : (weighted / weights) * 10;
}

export function velocityScore(stats: KeywordStats): number | null {
  const days = stats.previousCapturedDaysAgo ?? 0;
  if (!stats.previousTop10 || days < VELOCITY_MIN_DAYS) {
    return null;
  }
  const before = new Map(
    stats.previousTop10.map((item) => [item.storeAppId, item.ratingCount]),
  );
  const gains = stats.top10.flatMap((item) => {
    const then =
      item.storeAppId === undefined ? undefined : before.get(item.storeAppId);
    const [now] = finiteNumbers([item.ratingCount]);
    return then === undefined || now === undefined
      ? []
      : [(Math.max(0, now - then) / days) * DAYS_PER_MONTH];
  });
  return gains.length < VELOCITY_MIN_APPS
    ? null
    : logScale(median(gains), ...VELOCITY_BOUNDS);
}

export function baseDifficulty(stats: KeywordStats): number {
  return (
    DIFFICULTY_WEIGHTS.strength * strengthScore(stats) +
    DIFFICULTY_WEIGHTS.dominance * dominanceScore(stats) +
    DIFFICULTY_WEIGHTS.targeting *
      serpRelevance(stats.top10, stats.keywordText) *
      10 +
    DIFFICULTY_WEIGHTS.freshness * freshnessScore(stats) +
    DIFFICULTY_WEIGHTS.depth * competitorsScore(stats)
  );
}

export function computeDifficulty(stats: KeywordStats): number {
  if (stats.top10.length === 0) {
    return 0;
  }
  const padding = paddingFactor(stats.top10, stats.keywordText);
  const flags = serpFlags(stats);
  const base = baseDifficulty(stats);
  const velocity = velocityScore(stats);
  const blended =
    velocity === null
      ? base
      : (1 - VELOCITY_WEIGHT) * base + VELOCITY_WEIGHT * velocity;
  let difficulty =
    blended * (PADDED_DISCOUNT_FLOOR + (1 - PADDED_DISCOUNT_FLOOR) * padding);
  if (flags.includes('brand')) {
    difficulty = Math.max(difficulty, BRAND_DIFFICULTY_FLOOR);
  }
  if (flags.includes('weak_leader')) {
    difficulty = Math.min(difficulty, WEAK_LEADER_DIFFICULTY_CAP);
  }
  if (flags.includes('small_serp')) {
    difficulty = Math.min(difficulty, SMALL_SERP_DIFFICULTY_CAP);
  }
  return clamp(difficulty);
}
