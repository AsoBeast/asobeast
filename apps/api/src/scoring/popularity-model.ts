import { searchKey } from '@asobeast/shared';
import { finiteNumbers, median } from './curves';
import { SerpApp } from './formulas';
import { EVIDENCE_EXACT, titleEvidence, titleMatch } from './serp-signals';
import { PREFIX_PROBE_CAP, SuggestReach } from './suggest-reach';

export const MODEL_DEPTH = 25;
export const EXACT_LEADER_DEPTH = 5;
export const MAX_WORDS = 6;
// log10 of 100k ratings: an exact title match this strong marks a head term.
export const EXACT_HEAD_MAGNITUDE = 5;
export const POPULARITY_MIN = 1;
export const POPULARITY_MAX = 100;
export const NEUTRAL_CONTINUATIONS = 5;

export interface SuggestEvidence {
  continuations: number;
  reach: SuggestReach;
}

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
  suggested: number;
  early: number;
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
  'suggested',
  'early',
];

export type PopularityWeights = Record<PopularityFeature | 'intercept', number>;

// Fitted by `pnpm --filter api scoring:popularity-study fit` against the
// Apple Ads top search terms (US, week of 2026-09-20) and a reference of
// published popularity, and with STUDY_LISTED_WEIGHT=0 for the unlisted
// weights. Refit with the study, never by hand.
export const POPULARITY_WEIGHTS: PopularityWeights = {
  intercept: 1.6869,
  leader: 0.1742,
  depth: 0.056,
  titled: 0.3249,
  exact: 0.4516,
  exactLeader: 0.0473,
  words: 0.0476,
  relevance: -0.0247,
  weightedLeader: -0.1278,
  results: -0.4976,
  exactHead: -0.0294,
  continuations: 0.644,
  suggested: -0.1221,
  early: 0.9675,
};

export const UNLISTED_POPULARITY_WEIGHTS: PopularityWeights = {
  intercept: 2.0417,
  leader: 0.0513,
  depth: 0.0564,
  titled: 0.3694,
  exact: 0.6794,
  exactLeader: 0.0211,
  words: 0.0267,
  relevance: -0.5637,
  weightedLeader: -0.0051,
  results: -0.1843,
  exactHead: 0.2231,
  continuations: 0.384,
  suggested: -0.029,
  early: 0.656,
};

const magnitude = (count: number): number => Math.log10(1 + Math.max(0, count));

const ratingsOf = (apps: SerpApp[]): number[] =>
  finiteNumbers(apps.map((app) => app.ratingCount));

const strongest = (apps: SerpApp[]): number => Math.max(0, ...ratingsOf(apps));

const suggestedShare = (reach: SuggestReach): number =>
  reach.status === 'absent' ? 0 : 1;

const earlyShare = (reach: SuggestReach): number =>
  reach.status === 'hit'
    ? (PREFIX_PROBE_CAP + 1 - Math.min(reach.prefixLength, PREFIX_PROBE_CAP)) /
      PREFIX_PROBE_CAP
    : 0;

export function popularityFeatures(
  results: SerpApp[],
  keyword: string,
  suggest: SuggestEvidence,
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
    continuations: magnitude(suggest.continuations),
    suggested: suggestedShare(suggest.reach),
    early: earlyShare(suggest.reach),
  };
}

export function predictPopularity(
  features: PopularityFeatures,
  weights: PopularityWeights = POPULARITY_WEIGHTS,
): number {
  return Math.expm1(
    POPULARITY_FEATURES.reduce(
      (sum, name) => sum + weights[name] * features[name],
      weights.intercept,
    ),
  );
}

export function estimatePopularity(
  results: SerpApp[],
  keyword: string,
  suggest: SuggestEvidence,
  weights: PopularityWeights = POPULARITY_WEIGHTS,
): number | null {
  const features = popularityFeatures(results, keyword, suggest);
  if (features === null) {
    return null;
  }
  const raw = predictPopularity(features, weights);
  return Math.round(Math.min(POPULARITY_MAX, Math.max(POPULARITY_MIN, raw)));
}
