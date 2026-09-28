import { searchKey, Store } from '@asobeast/shared';
import { clamp, finiteNumbers } from './curves';
import { KeywordStats, SerpApp } from './formulas';
import { serpFlags } from './serp-flags';
import { titleTargets } from './serp-signals';

export interface DifficultyWeights {
  base: number;
  strength: number;
  targeting: number;
  perCharacter: number;
}

export const DIFFICULTY_WEIGHTS: Record<Store, DifficultyWeights> = {
  APP_STORE: { base: 13, strength: 40, targeting: 26, perCharacter: 0 },
  GOOGLE_PLAY: { base: 15, strength: 78, targeting: 21, perCharacter: 0.7 },
};
export const STRENGTH_FLOOR_RATINGS = 1_000;
export const STRENGTH_CEILING_RATINGS = 1_000_000;

const STRENGTH_SPAN = Math.log10(
  STRENGTH_CEILING_RATINGS / STRENGTH_FLOOR_RATINGS,
);

const mean = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

export const ratingStrength = (ratings: number): number =>
  ratings <= 0
    ? 0
    : clamp(Math.log10(ratings / STRENGTH_FLOOR_RATINGS) / STRENGTH_SPAN, 0, 1);

export const pageStrength = (apps: SerpApp[]): number =>
  mean(finiteNumbers(apps.map((app) => app.ratingCount)).map(ratingStrength));

export const targetingShare = (apps: SerpApp[], keyword: string): number =>
  mean(apps.map((app) => (titleTargets(app.title, keyword) ? 1 : 0)));

function difficulty100(apps: SerpApp[], keyword: string, store: Store): number {
  if (apps.length === 0) {
    return 0;
  }
  const weights = DIFFICULTY_WEIGHTS[store];
  const total =
    weights.base +
    weights.strength * pageStrength(apps) +
    weights.targeting * targetingShare(apps, keyword) -
    weights.perCharacter * searchKey(keyword).length;
  return clamp(Math.trunc(total), 1, 100);
}

export const computeDifficulty = (stats: KeywordStats): number =>
  difficulty100(stats.top10, stats.keywordText, stats.store) / 10;

export function entryDifficulty(stats: KeywordStats): number | null {
  if (!serpFlags(stats).includes('brand')) {
    return null;
  }
  return (
    difficulty100(stats.top10.slice(1), stats.keywordText, stats.store) / 10
  );
}
