import { Store } from '@prisma/client';
import { listingSegments, normalizeText, tokenize } from '@asobeast/shared';
import { containsTerm, isUnsegmented } from '../common/text/scripts';
import { extractCandidates } from './extraction';
import { seedSources } from './listing-seed';

export const COMPETITOR_SEED_LIMIT = 5;
export const COMPETITOR_SEARCH_MAX_WORDS = 4;

const TITLE_PUNCTUATION = /[:|–—]| - /u;

export interface CompetitorListing {
  appId: string;
  name: string | null;
  title: string;
  subtitle: string | null;
  summary: string | null;
  languages: readonly string[];
}

export interface CompetitorSeed {
  text: string;
  usedBy: number;
}

export interface CompetitorHint {
  seed: string;
  position: number;
  term: string;
}

export interface CompetitorSearch {
  text: string;
  seed: string;
  usedByCount: number;
}

export interface CompetitorSearchContext {
  seeds: readonly CompetitorSeed[];
  excluded: ReadonlySet<string>;
  titles: readonly string[];
  names: readonly string[];
  limit: number;
}

function phrasesOf(listing: CompetitorListing, store: Store): Set<string> {
  const sources = seedSources(store);
  return new Set(
    extractCandidates(
      {
        title: listing.title,
        subtitle: listing.subtitle ?? undefined,
        summary: listing.summary ?? undefined,
      },
      listing.languages,
    )
      .filter((candidate) => sources.includes(candidate.source))
      .map((candidate) => candidate.text),
  );
}

function brandWordsOf({ title }: CompetitorListing): Set<string> {
  const segments = listingSegments(title).filter(
    (segment) => tokenize(segment).length > 0,
  );
  return segments.length > 1 ? new Set(tokenize(segments[0])) : new Set();
}

const isSeedShaped = (text: string): boolean =>
  text.includes(' ') || isUnsegmented(text);

const bySeedOrder = (a: CompetitorSeed, b: CompetitorSeed): number =>
  b.usedBy - a.usedBy ||
  tokenize(a.text).length - tokenize(b.text).length ||
  a.text.localeCompare(b.text, 'en');

export function competitorSeeds(
  listings: readonly CompetitorListing[],
  store: Store,
  limit = COMPETITOR_SEED_LIMIT,
): CompetitorSeed[] {
  const owners = new Map<string, CompetitorListing[]>();
  for (const listing of listings) {
    for (const phrase of phrasesOf(listing, store)) {
      owners.set(phrase, [...(owners.get(phrase) ?? []), listing]);
    }
  }
  return [...owners.entries()]
    .filter(([text, users]) => {
      if (!isSeedShaped(text)) return false;
      if (users.length > 1) return true;
      const brand = brandWordsOf(users[0]);
      return !tokenize(text).every((word) => brand.has(word));
    })
    .map(([text, users]) => ({ text, usedBy: users.length }))
    .sort(bySeedOrder)
    .slice(0, limit);
}

function isCandidate(
  text: string,
  seed: string,
  context: CompetitorSearchContext,
  blocked: ReadonlySet<string>,
): boolean {
  return (
    text.length > 0 &&
    tokenize(text).length <= COMPETITOR_SEARCH_MAX_WORDS &&
    !context.excluded.has(text) &&
    !blocked.has(text) &&
    tokenize(seed).every((word) => containsTerm(text, word))
  );
}

export function competitorSearches(
  hints: readonly CompetitorHint[],
  context: CompetitorSearchContext,
): CompetitorSearch[] {
  const usedBy = new Map(context.seeds.map((seed) => [seed.text, seed.usedBy]));
  const blocked = new Set(
    [
      ...context.seeds.map((seed) => seed.text),
      ...context.titles,
      ...context.names,
    ].map(normalizeText),
  );
  const best = new Map<string, CompetitorHint>();
  for (const hint of hints) {
    if (TITLE_PUNCTUATION.test(hint.term)) continue;
    const text = normalizeText(hint.term);
    if (!isCandidate(text, hint.seed, context, blocked)) continue;
    const kept = best.get(text);
    if (!kept || hint.position < kept.position) best.set(text, hint);
  }
  const rank = (seed: string) => usedBy.get(seed) ?? 0;
  return [...best.entries()]
    .sort(
      ([textA, a], [textB, b]) =>
        rank(b.seed) - rank(a.seed) ||
        a.position - b.position ||
        textA.localeCompare(textB, 'en'),
    )
    .slice(0, context.limit)
    .map(([text, hint]) => ({
      text,
      seed: hint.seed,
      usedByCount: rank(hint.seed),
    }));
}
