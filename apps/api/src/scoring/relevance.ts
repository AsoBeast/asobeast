import { KeywordSource, tokenize } from '@asobeast/shared';
import { clamp } from './curves';

export interface RankingEvidence {
  position: number | null;
  checked: boolean;
}

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

export const RANKED_RELEVANCE_POSITION = 50;
export const RANKED_RELEVANCE_FLOOR = 70;
export const UNRANKED_PENALTY = 10;
export const UNRANKED_PENALTY_SOURCES: readonly KeywordSource[] = [
  'DESCRIPTION',
  'SUGGESTED',
  'COMPETITOR',
];

function withOverlap(
  base: number,
  keywordText: string,
  snapshotText: string,
): number {
  const tokens = tokenize(keywordText);
  if (tokens.length === 0) {
    return base;
  }
  const snapshotTokens = new Set(tokenize(snapshotText));
  const overlap = tokens.filter((token) => snapshotTokens.has(token)).length;
  if (overlap === tokens.length) {
    return base + ASOBEAST_DEFAULTS.relevanceOverlapBonus;
  }
  return overlap === 0 ? base - ASOBEAST_DEFAULTS.relevanceOverlapBonus : base;
}

function withRankingEvidence(
  relevance: number,
  source: KeywordSource,
  ranking?: RankingEvidence,
): number {
  if (!ranking || !ranking.checked) {
    return relevance;
  }
  if (
    ranking.position !== null &&
    ranking.position >= 1 &&
    ranking.position <= RANKED_RELEVANCE_POSITION
  ) {
    return Math.max(relevance, RANKED_RELEVANCE_FLOOR);
  }
  return ranking.position === null && UNRANKED_PENALTY_SOURCES.includes(source)
    ? relevance - UNRANKED_PENALTY
    : relevance;
}

export const defaultRelevance = (
  source: KeywordSource,
  keywordText: string,
  snapshotText: string,
  ranking?: RankingEvidence,
): number => {
  const base = ASOBEAST_DEFAULTS.relevanceBySource[source];
  const relevance = withOverlap(base, keywordText, snapshotText);
  return clamp(withRankingEvidence(relevance, source, ranking), 1, 100);
};
