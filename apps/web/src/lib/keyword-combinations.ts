import {
  isStopword,
  tokenize,
  TRACKED_KEYWORD_CHAR_LIMIT,
  type AppSnapshotSummary,
  type MetadataField,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";

export const COMBINATION_MIN_WORD_LENGTH = 2;
export const COMBINATION_MAX_WORDS = 3;
export const COMBINATION_LIMIT = 2000;
export const COMBINATION_PAGE_SIZE = 50;

export const COMBINATION_WORD_COUNTS = [1, 2, COMBINATION_MAX_WORDS] as const;
export type CombinationWordCount = (typeof COMBINATION_WORD_COUNTS)[number];

export const COMBINATION_STATUSES = ["tracked", "paused", "untracked"] as const;
export type CombinationStatus = (typeof COMBINATION_STATUSES)[number];

export const COMBINATION_FIELDS = {
  APP_STORE: ["title", "subtitle", "keywordField"],
  GOOGLE_PLAY: ["title", "shortDescription"],
} as const satisfies Record<Store, readonly MetadataField[]>;

export type CombinationField = (typeof COMBINATION_FIELDS)[Store][number];

type ListingSnapshot = Pick<
  AppSnapshotSummary,
  "title" | "subtitle" | "summary"
>;

export interface CombinationListing {
  store: Store;
  snapshot: ListingSnapshot | null;
  keywordField: readonly string[];
}

export type TrackedPhrase = Pick<
  TrackedKeywordItem,
  "text" | "active" | "country"
>;

export interface CombinationInput {
  listing: CombinationListing;
  tracked: readonly TrackedPhrase[];
  market: string;
}

export interface ListingWord {
  text: string;
  fields: CombinationField[];
}

export interface KeywordCombination {
  key: string;
  phrase: string;
  wordCount: CombinationWordCount;
  fields: CombinationField[];
  status: CombinationStatus;
  trackedAs: string | null;
}

export interface CombinationSet {
  words: ListingWord[];
  combinations: KeywordCombination[];
  total: number;
  truncated: boolean;
}

interface TrackedMatch {
  status: Exclude<CombinationStatus, "untracked">;
  text: string;
}

const SNAPSHOT_FIELD = {
  title: "title",
  subtitle: "subtitle",
  shortDescription: "summary",
} as const satisfies Record<
  Exclude<CombinationField, "keywordField">,
  keyof ListingSnapshot
>;

const FIELD_ORDER: readonly CombinationField[] = [
  ...new Set<CombinationField>([
    ...COMBINATION_FIELDS.APP_STORE,
    ...COMBINATION_FIELDS.GOOGLE_PLAY,
  ]),
];

function fieldTexts(
  { snapshot, keywordField }: CombinationListing,
  field: CombinationField,
): readonly string[] {
  if (field === "keywordField") return keywordField;
  const value = snapshot?.[SNAPSHOT_FIELD[field]];
  return value ? [value] : [];
}

function isCombinationWord(token: string): boolean {
  return token.length >= COMBINATION_MIN_WORD_LENGTH && !isStopword(token);
}

export function listingWords(listing: CombinationListing): ListingWord[] {
  const words = new Map<string, CombinationField[]>();
  for (const field of COMBINATION_FIELDS[listing.store]) {
    for (const token of fieldTexts(listing, field).flatMap(tokenize)) {
      if (!isCombinationWord(token)) continue;
      const fields = words.get(token) ?? [];
      words.set(token, fields.includes(field) ? fields : [...fields, field]);
    }
  }
  return [...words].map(([text, fields]) => ({ text, fields }));
}

export function combinationKey(text: string): string {
  return [...new Set(tokenize(text).filter((word) => !isStopword(word)))]
    .sort()
    .join(" ");
}

function trackedMatches(
  tracked: readonly TrackedPhrase[],
  market: string,
): Map<string, TrackedMatch> {
  const matches = new Map<string, TrackedMatch>();
  for (const row of tracked) {
    if (row.country !== market) continue;
    const key = combinationKey(row.text);
    const known = matches.get(key);
    if (row.active && known?.status !== "tracked") {
      matches.set(key, { status: "tracked", text: row.text });
    } else if (!known) {
      matches.set(key, { status: "paused", text: row.text });
    }
  }
  return matches;
}

function* indexTuples(
  length: number,
  size: number,
  start = 0,
): Generator<number[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let first = start; first <= length - size; first += 1) {
    for (const rest of indexTuples(length, size - 1, first + 1)) {
      yield [first, ...rest];
    }
  }
}

function fieldsOf(words: readonly ListingWord[]): CombinationField[] {
  const present = new Set(words.flatMap((word) => word.fields));
  return FIELD_ORDER.filter((field) => present.has(field));
}

export function buildCombinations({
  listing,
  tracked,
  market,
}: CombinationInput): CombinationSet {
  const words = listingWords(listing);
  const matches = trackedMatches(tracked, market);
  const combinations: KeywordCombination[] = [];
  let total = 0;
  for (const wordCount of COMBINATION_WORD_COUNTS) {
    for (const indexes of indexTuples(words.length, wordCount)) {
      const parts = indexes.map((index) => words[index]);
      const phrase = parts.map((word) => word.text).join(" ");
      if (phrase.length > TRACKED_KEYWORD_CHAR_LIMIT) continue;
      total += 1;
      if (combinations.length === COMBINATION_LIMIT) continue;
      const key = combinationKey(phrase);
      const match = matches.get(key);
      combinations.push({
        key,
        phrase,
        wordCount,
        fields: fieldsOf(parts),
        status: match?.status ?? "untracked",
        trackedAs: match?.text ?? null,
      });
    }
  }
  return { words, combinations, total, truncated: total > combinations.length };
}
