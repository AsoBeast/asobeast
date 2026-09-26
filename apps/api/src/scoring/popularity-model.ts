import { searchKey } from '@asobeast/shared';
import { finiteNumbers, median } from './curves';
import { SerpApp } from './formulas';
import { EVIDENCE_EXACT, titleEvidence, titleMatch } from './serp-signals';

export const MODEL_DEPTH = 25;
export const EXACT_LEADER_DEPTH = 5;
export const MAX_WORDS = 6;
// log10 of 100k ratings: an exact title match this strong marks a head term.
export const EXACT_HEAD_MAGNITUDE = 5;
export const POPULARITY_MIN = 1;
export const POPULARITY_MAX = 100;
export const NEUTRAL_CONTINUATIONS = 5;

export interface PopularityFeatures {
  leader: number;
  depth: number;
  titled: number;
  exact: number;
  exactLeader: number;
  words: number;
  relevance: number;
  weightedLeader: number;
  results: number;
  exactHead: number;
  continuations: number;
}

export type PopularityFeature = keyof PopularityFeatures;

export const POPULARITY_FEATURES: readonly PopularityFeature[] = [
  'leader',
  'depth',
  'titled',
  'exact',
  'exactLeader',
  'words',
  'relevance',
  'weightedLeader',
  'results',
  'exactHead',
  'continuations',
];

export type PopularityWeights = Record<PopularityFeature | 'intercept', number>;

// Fitted by `pnpm --filter api scoring:popularity-study fit` against the
// Apple Ads top search terms (US, week of 2026-09-13). Refit with the study,
// never by hand.
export const POPULARITY_WEIGHTS: PopularityWeights = {
  intercept: 36.5756,
  leader: 0.902,
  depth: 1.9378,
  titled: 10.3165,
  exact: -8.6671,
  exactLeader: 0.561,
  words: -1.732,
  relevance: 0.192,
  weightedLeader: -1.2402,
  results: -8.8726,
  exactHead: 3.8553,
  continuations: 13.4935,
};

const magnitude = (count: number): number => Math.log10(1 + Math.max(0, count));

const ratingsOf = (apps: SerpApp[]): number[] =>
  finiteNumbers(apps.map((app) => app.ratingCount));

const strongest = (apps: SerpApp[]): number => Math.max(0, ...ratingsOf(apps));

export function popularityFeatures(
  results: SerpApp[],
  keyword: string,
  continuations: number,
): PopularityFeatures | null {
  const page = results.slice(0, MODEL_DEPTH);
  if (page.length === 0) {
    return null;
  }
  const matches = page.map((app) => titleMatch(app.title, keyword));
  const exactFlags = page.map(
    (app) => titleEvidence(app.title, keyword) === EVIDENCE_EXACT,
  );
  const share = (flags: boolean[]): number =>
    flags.filter(Boolean).length / page.length;
  const relevance =
    matches.reduce((sum, match) => sum + match.evidence, 0) / page.length;
  const leader = magnitude(
    strongest(page.slice(0, Math.max(1, Math.floor(page.length / 2)))),
  );
  const exactLeader = magnitude(
    strongest(
      page.slice(0, EXACT_LEADER_DEPTH).filter((_, index) => exactFlags[index]),
    ),
  );
  const words = searchKey(keyword).split(' ').filter(Boolean).length;
  return {
    leader,
    depth: magnitude(median(ratingsOf(page))),
    titled: share(matches.map((match) => match.strong)),
    exact: share(exactFlags),
    exactLeader,
    words: Math.min(Math.max(words, 1), MAX_WORDS) - 1,
    relevance,
    weightedLeader: leader * relevance,
    results: page.length / MODEL_DEPTH,
    exactHead: Math.max(0, exactLeader - EXACT_HEAD_MAGNITUDE) ** 2,
    continuations: magnitude(continuations),
  };
}

export function predictPopularity(
  features: PopularityFeatures,
  weights: PopularityWeights = POPULARITY_WEIGHTS,
): number {
  return POPULARITY_FEATURES.reduce(
    (sum, name) => sum + weights[name] * features[name],
    weights.intercept,
  );
}

export function estimatePopularity(
  results: SerpApp[],
  keyword: string,
  continuations: number,
  weights: PopularityWeights = POPULARITY_WEIGHTS,
): number | null {
  const features = popularityFeatures(results, keyword, continuations);
  if (features === null) {
    return null;
  }
  const raw = predictPopularity(features, weights);
  return Math.round(Math.min(POPULARITY_MAX, Math.max(POPULARITY_MIN, raw)));
}
