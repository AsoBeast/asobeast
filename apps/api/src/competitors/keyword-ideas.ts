import {
  CompetitorKeywordIdea,
  isStopword,
  normalizeText,
  tokenize,
} from '@asobeast/shared';
import { extractCandidates } from '../keywords/extraction';
import { listingSegments } from '../keywords/listing-segments';

export const IDEA_SEED_LIMIT = 12;
const IDEA_MAX_WORDS = 4;

export interface IdeaListing {
  appId: string;
  name: string | null;
  title: string;
  subtitle: string | null;
}

export interface IdeaHint {
  seed: string;
  position: number;
  term: string;
}

interface IdeaSource {
  appId: string;
  name: string | null;
  phrases: ReadonlySet<string>;
  words: ReadonlySet<string>;
  brand: ReadonlySet<string>;
}

const APP_NAME_MARK = /[:|&–—·.]| - /u;

function brandWords(title: string): Set<string> {
  const segments = listingSegments(title).filter(
    (segment) => segment.trim().length > 0,
  );
  return new Set(segments.length > 1 ? tokenize(segments[0]) : []);
}

function ideaSource(
  listing: IdeaListing,
  languages: readonly string[],
): IdeaSource {
  const phrases = extractCandidates(
    { title: listing.title, subtitle: listing.subtitle ?? undefined },
    languages,
  ).map((candidate) => candidate.text);
  return {
    appId: listing.appId,
    name: listing.name,
    phrases: new Set(phrases),
    words: new Set(phrases.flatMap((phrase) => tokenize(phrase))),
    brand: brandWords(listing.title),
  };
}

export function ideaSources(
  listings: readonly IdeaListing[],
  languages: readonly string[],
): IdeaSource[] {
  return listings.map((listing) => ideaSource(listing, languages));
}

const within = (words: readonly string[], set: ReadonlySet<string>): boolean =>
  words.every((word) => set.has(word));

const contentWords = (text: string): string[] =>
  tokenize(text).filter((word) => !isStopword(word));

function isBrandOnly(
  words: readonly string[],
  sources: readonly IdeaSource[],
): boolean {
  const owners = sources.filter((source) => within(words, source.brand));
  if (owners.length === 0) {
    return false;
  }
  return sources.every(
    (source) => owners.includes(source) || !within(words, source.words),
  );
}

export function ideaSeeds(
  sources: readonly IdeaSource[],
  limit = IDEA_SEED_LIMIT,
): string[] {
  const users = new Map<string, number>();
  for (const source of sources) {
    for (const phrase of source.phrases) {
      users.set(phrase, (users.get(phrase) ?? 0) + 1);
    }
  }
  return [...users.entries()]
    .map(([phrase, usedBy]) => ({
      phrase,
      usedBy,
      size: tokenize(phrase).length,
    }))
    .filter(
      ({ phrase, size }) => size > 1 && !isBrandOnly(tokenize(phrase), sources),
    )
    .sort(
      (a, b) =>
        b.usedBy - a.usedBy ||
        a.size - b.size ||
        a.phrase.localeCompare(b.phrase),
    )
    .slice(0, limit)
    .map(({ phrase }) => phrase);
}

export function keywordIdeas(input: {
  sources: readonly IdeaSource[];
  hints: readonly IdeaHint[];
  popularity: ReadonlyMap<string, number>;
  excluded: ReadonlySet<string>;
  limit: number;
}): CompetitorKeywordIdea[] {
  const best = new Map<string, IdeaHint>();
  for (const hint of input.hints) {
    if (APP_NAME_MARK.test(hint.term)) {
      continue;
    }
    const text = normalizeText(hint.term);
    const words = contentWords(text);
    if (
      words.length === 0 ||
      tokenize(text).length > IDEA_MAX_WORDS ||
      input.excluded.has(text) ||
      !within(tokenize(hint.seed), new Set(tokenize(text))) ||
      isBrandOnly(words, input.sources)
    ) {
      continue;
    }
    const known = best.get(text);
    if (!known || hint.position < known.position) {
      best.set(text, hint);
    }
  }

  return [...best.entries()]
    .map(([text, hint]) => ({
      text,
      popularity: input.popularity.get(text) ?? null,
      suggestRank: hint.position,
      seed: hint.seed,
      usedBy: input.sources
        .filter((source) => within(contentWords(text), source.words))
        .map(({ appId, name }) => ({ appId, name })),
    }))
    .sort(
      (a, b) =>
        (b.popularity ?? 0) - (a.popularity ?? 0) ||
        a.suggestRank - b.suggestRank ||
        b.usedBy.length - a.usedBy.length ||
        a.text.localeCompare(b.text),
    )
    .slice(0, input.limit);
}
