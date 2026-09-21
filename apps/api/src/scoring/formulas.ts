import { KeywordSource, Store, tokenize } from '@asobeast/shared';

import { clamp } from './curves';
import { SuggestReach } from './suggest-reach';

export { toDifficulty100, toVolume } from '@asobeast/shared';
export { clamp, linear, logScale } from './curves';

export interface PreviousSerpApp {
  storeAppId: string;
  ratingCount: number;
}

export interface KeywordStats {
  store: Store;
  keywordText: string;
  resultCount: number;
  top10: Array<{
    storeAppId?: string;
    title: string;
    developer?: string;
    ratingCount?: number;
    ratingAvg?: number;
    daysSinceUpdate?: number;
    installs?: number;
  }>;
  top30TitleMatchCount: number;
  suggest: SuggestReach;
  previousTop10?: PreviousSerpApp[];
  previousCapturedDaysAgo?: number;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

export const OPPORTUNITY_WEIGHTS = {
  volume: 0.4,
  difficulty: 0.3,
  relevance: 0.3,
} as const;

export const ASOBEAST_DEFAULTS = {
  relevanceBySource: {
    TITLE: 90,
    SUBTITLE: 90,
    KEYWORD_FIELD: 90,
    MANUAL: 80,
    DESCRIPTION: 70,
    SUGGESTED: 60,
    COMPETITOR: 50,
  } satisfies Record<KeywordSource, number>,
  relevanceOverlapBonus: 10,
} as const;

export const defaultRelevance = (
  source: KeywordSource,
  keywordText: string,
  snapshotText: string,
): number => {
  const base = ASOBEAST_DEFAULTS.relevanceBySource[source];
  const tokens = tokenize(keywordText);
  const snapshotTokens = new Set(tokenize(snapshotText));
  let relevance = base;
  if (tokens.length > 0) {
    const overlap = tokens.filter((token) => snapshotTokens.has(token)).length;
    if (overlap === tokens.length) {
      relevance = base + ASOBEAST_DEFAULTS.relevanceOverlapBonus;
    } else if (overlap === 0) {
      relevance = base - ASOBEAST_DEFAULTS.relevanceOverlapBonus;
    }
  }
  return clamp(relevance, 1, 100);
};

export const computeOpportunity = (
  volume: number | null,
  difficulty100: number | null,
  relevance: number,
): number | null => {
  if (volume === null || difficulty100 === null) {
    return null;
  }
  const score =
    volume * OPPORTUNITY_WEIGHTS.volume +
    (100 - difficulty100) * OPPORTUNITY_WEIGHTS.difficulty +
    relevance * OPPORTUNITY_WEIGHTS.relevance;
  return round1(clamp(score, 0, 100));
};
