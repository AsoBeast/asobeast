import { searchKey } from '@asobeast/shared';
import { clamp, finiteNumbers, median } from './curves';
import { KeywordStats, SerpApp } from './formulas';
import { serpFlags } from './serp-flags';
import { titleMatch } from './serp-signals';

type Band = readonly [threshold: number, score: number];

export const DIFFICULTY_WEIGHTS = {
  ratingVolume: 0.3,
  velocity: 0.1,
  dominance: 0.2,
  quality: 0.1,
  age: 0.1,
  diversity: 0.1,
  titles: 0.1,
} as const;
export const RATING_VOLUME_BANDS: Band[] = [
  [50, 5],
  [200, 15],
  [500, 30],
  [2_000, 50],
  [5_000, 65],
  [10_000, 78],
  [25_000, 88],
  [100_000, 95],
];
export const VELOCITY_BANDS: Band[] = [
  [10, 5],
  [50, 15],
  [200, 30],
  [1_000, 50],
  [5_000, 70],
  [20_000, 85],
  [50_000, 95],
];
export const QUALITY_BANDS: Band[] = [
  [3, 20],
  [3.5, 35],
  [4, 50],
  [4.3, 70],
  [4.5, 85],
  [5, 100],
];
export const AGE_BANDS: Band[] = [
  [0.5, 10],
  [1, 20],
  [2, 35],
  [3, 50],
  [5, 70],
  [8, 85],
  [10, 100],
];
export const UNDATED_SCORE = 50;
export const DOMINANCE_LOG_CEILING = 7;
export const DOMINANCE_TOP_WEIGHT = 2;
export const VELOCITY_MIN_AGE_YEARS = 0.5;
export const FULL_SAMPLE_SIZE = 10;
export const BACKFILL_SLOPE = 2.6;
export const BACKFILL_FLOOR = 0.3;
export const SMALL_PAGE_CAPS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 31,
  4: 40,
};
export const WEAK_LEADER_MAX_RATINGS = 1_000;
export const WEAK_LEADER_CAP_BASE = 15;
export const WEAK_LEADER_CAP_RANGE = 35;
export const TARGETED_MATCH_RATIO = 0.2;
export const BACKFILL_DISCOUNT_FLOOR = 0.6;
export const BRAND_RUNNER_UPS = 4;
export const BRAND_MIN_RUNNER_UP_RATINGS = 10_000;
const DAYS_PER_YEAR = 365.25;

function banded(value: number, bands: Band[], log: boolean): number {
  if (value <= 0) {
    return 0;
  }
  const index = bands.findIndex(([threshold]) => value < threshold);
  if (index === -1) {
    return 100;
  }
  const [threshold, score] = bands[index];
  if (index === 0) {
    return (value / threshold) * score;
  }
  const [below, belowScore] = bands[index - 1];
  const ratio = log
    ? Math.log(value / below) / Math.log(threshold / below)
    : (value - below) / (threshold - below);
  return belowScore + ratio * (score - belowScore);
}

const ratingsOf = (app: SerpApp | undefined): number | null =>
  app !== undefined && Number.isFinite(app.ratingCount)
    ? (app.ratingCount as number)
    : null;

const knownRatings = (apps: SerpApp[]): number[] =>
  finiteNumbers(apps.map((app) => app.ratingCount));

const yearsOf = (app: SerpApp): number | null =>
  Number.isFinite(app.daysSinceRelease)
    ? (app.daysSinceRelease ?? 0) / DAYS_PER_YEAR
    : null;

const weakness = (ratings: number): number =>
  Math.log10(ratings + 1) / Math.log10(WEAK_LEADER_MAX_RATINGS + 1);

export const ratingVolumeScore = (apps: SerpApp[]): number =>
  banded(median(knownRatings(apps)), RATING_VOLUME_BANDS, true);

export function velocityScore(apps: SerpApp[]): number {
  const perYear = apps.flatMap((app) => {
    const years = yearsOf(app);
    const ratings = ratingsOf(app);
    return years === null || ratings === null || ratings <= 0
      ? []
      : [ratings / Math.max(VELOCITY_MIN_AGE_YEARS, years)];
  });
  return perYear.length === 0
    ? UNDATED_SCORE
    : banded(median(perYear), VELOCITY_BANDS, true);
}

export function dominanceScore(apps: SerpApp[]): number {
  const topHalf = Math.max(Math.floor(apps.length / 2), 1);
  let total = 0;
  let weights = 0;
  apps.forEach((app, index) => {
    const ratings = ratingsOf(app);
    if (ratings === null) {
      return;
    }
    const weight = index < topHalf ? DOMINANCE_TOP_WEIGHT : 1;
    weights += weight;
    if (ratings > 0) {
      total +=
        weight * Math.min(1, Math.log10(ratings) / DOMINANCE_LOG_CEILING);
    }
  });
  return weights === 0 ? 0 : Math.min(100, (total / weights) * 100);
}

export function qualityScore(apps: SerpApp[]): number {
  let weighted = 0;
  let weights = 0;
  for (const app of apps) {
    const ratings = ratingsOf(app) ?? 0;
    if (
      Number.isFinite(app.ratingAvg) &&
      (app.ratingAvg ?? 0) > 0 &&
      ratings > 0
    ) {
      const weight = Math.log1p(ratings);
      weighted += (app.ratingAvg ?? 0) * weight;
      weights += weight;
    }
  }
  return banded(weights === 0 ? 0 : weighted / weights, QUALITY_BANDS, false);
}

export function ageScore(apps: SerpApp[]): number {
  const years = apps.flatMap((app) => yearsOf(app) ?? []);
  return years.length === 0
    ? UNDATED_SCORE
    : banded(
        years.reduce((sum, value) => sum + value, 0) / years.length,
        AGE_BANDS,
        false,
      );
}

export function diversityScore(apps: SerpApp[]): number {
  const publishers = new Set(
    apps.flatMap((app) => (app.developer ? [app.developer.toLowerCase()] : [])),
  );
  return Math.min(100, (publishers.size / apps.length) * 100);
}

interface RawDifficulty {
  total: number;
  matchRatio: number;
}

function rawDifficulty(apps: SerpApp[], keyword: string): RawDifficulty {
  const matches = apps.map((app) => titleMatch(app.title, keyword));
  const matchRatio =
    matches.filter((match) => match.strong).length / apps.length;
  const evidence =
    matches.reduce((sum, match) => sum + match.evidence, 0) / apps.length;
  const sample = Math.min(1, apps.length / FULL_SAMPLE_SIZE);
  const backfill = clamp(evidence * BACKFILL_SLOPE, BACKFILL_FLOOR, 1);
  const total = Math.trunc(
    DIFFICULTY_WEIGHTS.ratingVolume * ratingVolumeScore(apps) +
      DIFFICULTY_WEIGHTS.velocity * velocityScore(apps) +
      DIFFICULTY_WEIGHTS.dominance * dominanceScore(apps) * sample +
      DIFFICULTY_WEIGHTS.quality * qualityScore(apps) * sample * backfill +
      DIFFICULTY_WEIGHTS.age * ageScore(apps) * backfill +
      DIFFICULTY_WEIGHTS.diversity * diversityScore(apps) * sample * backfill +
      DIFFICULTY_WEIGHTS.titles * Math.min(100, matchRatio * 100) * sample,
  );
  return { total: clamp(total, 1, 100), matchRatio };
}

export function isBrandKeyword(apps: SerpApp[], keyword: string): boolean {
  const words = searchKey(keyword).split(' ').filter(Boolean);
  const [leader] = apps;
  const seller = searchKey(leader?.developer ?? '');
  const sellerWords = new Set(seller.split(' ').filter(Boolean));
  if (
    words.length === 0 ||
    sellerWords.size === 0 ||
    !words.every((word) => sellerWords.has(word))
  ) {
    return false;
  }
  if ((ratingsOf(leader) ?? 0) >= WEAK_LEADER_MAX_RATINGS) {
    return true;
  }
  const runnerUps = apps
    .slice(1)
    .filter((app) => searchKey(app.developer ?? '') !== seller)
    .slice(0, BRAND_RUNNER_UPS);
  return (
    runnerUps.length > 0 &&
    median(knownRatings(runnerUps)) >= BRAND_MIN_RUNNER_UP_RATINGS
  );
}

function weakLeaderCap(total: number, leader: number, ratio: number): number {
  const cap = Math.trunc(
    WEAK_LEADER_CAP_BASE + WEAK_LEADER_CAP_RANGE * weakness(leader),
  );
  if (total <= cap) {
    return total;
  }
  return ratio > TARGETED_MATCH_RATIO
    ? Math.trunc(cap + (total - cap) * ratio)
    : cap;
}

function backfillDiscount(
  total: number,
  leader: number,
  ratio: number,
): number {
  const ratioFactor = Math.min(1, BACKFILL_DISCOUNT_FLOOR + 2 * ratio);
  const discount = clamp(
    ratioFactor + (1 - ratioFactor) * weakness(leader),
    BACKFILL_DISCOUNT_FLOOR,
    1,
  );
  return Math.min(total, Math.max(1, Math.trunc(total * discount)));
}

function difficulty100(apps: SerpApp[], keyword: string): number {
  if (apps.length === 0) {
    return 0;
  }
  const raw = rawDifficulty(apps, keyword);
  let total = Math.min(raw.total, SMALL_PAGE_CAPS[apps.length] ?? 100);
  const leader = ratingsOf(apps[0]);
  if (
    apps.length >= 2 &&
    leader !== null &&
    leader < WEAK_LEADER_MAX_RATINGS &&
    !isBrandKeyword(apps, keyword)
  ) {
    total = weakLeaderCap(total, leader, raw.matchRatio);
    if (raw.matchRatio < TARGETED_MATCH_RATIO) {
      total = backfillDiscount(total, leader, raw.matchRatio);
    }
  }
  return clamp(total, 1, 100);
}

export const computeDifficulty = (stats: KeywordStats): number =>
  difficulty100(stats.serp, stats.keywordText) / 10;

export function entryDifficulty(stats: KeywordStats): number | null {
  if (!serpFlags(stats).includes('brand')) {
    return null;
  }
  return difficulty100(stats.serp.slice(1), stats.keywordText) / 10;
}
