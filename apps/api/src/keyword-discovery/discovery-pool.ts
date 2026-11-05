import { KeywordSource } from '@prisma/client';
import {
  DISCOVERY_POOL_LIMIT,
  DISCOVERY_SOURCES,
  DiscoverySource,
  normalizeText,
} from '@asobeast/shared';
import { checkKeywordText } from '../keywords/keywords.support';
import { defaultRelevance, RankingEvidence } from '../scoring/relevance';

export interface PoolCandidate {
  text: string;
  source: DiscoverySource;
  relevance: number;
  traffic: number | null;
}

export interface PoolOptions {
  excluded: ReadonlySet<string>;
  limit?: number;
}

export const keywordSourceOf = {
  title: 'TITLE',
  subtitle: 'SUBTITLE',
  description: 'DESCRIPTION',
  competitors: 'COMPETITOR',
  reviews: 'SUGGESTED',
  popularity: 'SUGGESTED',
  portfolio: 'SUGGESTED',
} as const satisfies Record<DiscoverySource, KeywordSource>;

export const discoveryRelevance = (
  source: DiscoverySource,
  text: string,
  listingText: string,
  ranking?: RankingEvidence,
): number =>
  defaultRelevance(keywordSourceOf[source], text, listingText, ranking);

const sourceRank = (source: DiscoverySource): number =>
  DISCOVERY_SOURCES.indexOf(source);

const outranks = (a: PoolCandidate, b: PoolCandidate): boolean =>
  a.relevance !== b.relevance
    ? a.relevance > b.relevance
    : sourceRank(a.source) < sourceRank(b.source);

const UNKNOWN_TRAFFIC = -1;

const largerTraffic = (a: number | null, b: number | null): number | null =>
  a === null || b === null ? (a ?? b) : Math.max(a, b);

const byPoolOrder = (a: PoolCandidate, b: PoolCandidate): number =>
  b.relevance - a.relevance ||
  (b.traffic ?? UNKNOWN_TRAFFIC) - (a.traffic ?? UNKNOWN_TRAFFIC) ||
  a.text.localeCompare(b.text);

export function buildPool(
  candidates: readonly PoolCandidate[],
  { excluded, limit = DISCOVERY_POOL_LIMIT }: PoolOptions,
): PoolCandidate[] {
  const skipped = new Set([...excluded].map(normalizeText));
  const folded = new Map<string, PoolCandidate>();
  for (const candidate of candidates) {
    const check = checkKeywordText(candidate.text);
    if (!check.ok || skipped.has(check.text)) continue;
    const next = { ...candidate, text: check.text };
    const kept = folded.get(check.text);
    if (!kept) {
      folded.set(check.text, next);
      continue;
    }
    const winner = outranks(next, kept) ? next : kept;
    folded.set(check.text, {
      ...winner,
      traffic: largerTraffic(kept.traffic, next.traffic),
    });
  }
  return [...folded.values()].sort(byPoolOrder).slice(0, limit);
}
