import {
  type KeywordBreakdownField,
  type KeywordBreakdownListing,
  type KeywordBreakdownSegment,
  type KeywordPlacement,
  type KeywordWordMatch,
  type LocalizationReadRole,
  normalizeText,
  searchKey,
  tokenize,
} from '@asobeast/shared';
import {
  containsTerm,
  SPACELESS_CHARACTER,
  SPACELESS_OR_NOT,
} from '../common/text/scripts';
import type { Surface } from '../metadata/localized-coverage';
import { coversKeyword } from './keyword-coverage';

export const PLACEMENT_STRENGTH: Record<KeywordPlacement, number> = {
  title: 6,
  subtitle: 5,
  shortDescription: 5,
  keywordField: 4,
  description: 3,
  split: 2,
  partial: 1,
  none: 0,
};

const PHRASE_PLACEMENTS = [
  'title',
  'subtitle',
  'shortDescription',
  'keywordField',
  'description',
] as const;

const MATCH_RANK: Record<KeywordWordMatch, number> = {
  exact: 2,
  folded: 1,
  none: 0,
};

const WORD_RUN = /[\p{L}\p{M}\p{N}]+/gu;

const stronger = (a: KeywordWordMatch, b: KeywordWordMatch) =>
  MATCH_RANK[b] > MATCH_RANK[a] ? b : a;

export const keywordWords = (keyword: string): string[] => [
  ...new Set(tokenize(keyword)),
];

export function wordMatch(value: string, word: string): KeywordWordMatch {
  if (containsTerm(normalizeText(value), word)) return 'exact';
  return containsTerm(searchKey(value), searchKey(word)) ? 'folded' : 'none';
}

interface Mark {
  start: number;
  end: number;
  match: KeywordWordMatch;
}

function spacelessMarks(
  run: string,
  offset: number,
  words: readonly string[],
): Mark[] {
  const marks: Mark[] = [];
  for (const word of words.filter((each) => SPACELESS_CHARACTER.test(each))) {
    for (
      let at = run.indexOf(word);
      at !== -1;
      at = run.indexOf(word, at + word.length)
    ) {
      marks.push({
        start: offset + at,
        end: offset + at + word.length,
        match: 'exact',
      });
    }
  }
  return marks;
}

function wordRunMark(
  run: string,
  offset: number,
  words: readonly string[],
): Mark[] {
  const match = words.reduce<KeywordWordMatch>(
    (best, word) => stronger(best, wordMatch(run, word)),
    'none',
  );
  return match === 'none'
    ? []
    : [{ start: offset, end: offset + run.length, match }];
}

function marksOf(text: string, words: readonly string[]): Mark[] {
  return [...text.matchAll(WORD_RUN)].flatMap((run) =>
    [...run[0].matchAll(SPACELESS_OR_NOT)].flatMap((part) => {
      const offset = run.index + part.index;
      return SPACELESS_CHARACTER.test(part[0])
        ? spacelessMarks(part[0], offset, words)
        : wordRunMark(part[0], offset, words);
    }),
  );
}

export function markWords(
  value: string,
  words: readonly string[],
): KeywordBreakdownSegment[] {
  const text = value.normalize('NFC');
  const matches = Array.from<KeywordWordMatch>({ length: text.length }).fill(
    'none',
  );
  for (const { start, end, match } of marksOf(text, words)) {
    for (let index = start; index < end; index += 1) {
      matches[index] = stronger(matches[index], match);
    }
  }
  const segments: KeywordBreakdownSegment[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = segments.at(-1);
    if (last?.match === matches[index]) last.text += text[index];
    else segments.push({ text: text[index], match: matches[index] });
  }
  return segments;
}

export function judgeField(
  { field, value }: Surface,
  keyword: string,
  words: readonly string[],
  withSegments: boolean,
): KeywordBreakdownField {
  return {
    field,
    phrase: value.length > 0 && coversKeyword(value, keyword),
    words: words.map((word) => ({
      word,
      match: value ? wordMatch(value, word) : 'none',
    })),
    segments: withSegments ? markWords(value, words) : null,
  };
}

export function placementOf(
  fields: readonly KeywordBreakdownField[],
): KeywordPlacement {
  const phrase = PHRASE_PLACEMENTS.find((placement) =>
    fields.some((field) => field.field === placement && field.phrase),
  );
  if (phrase) return phrase;
  const total = fields[0]?.words.length ?? 0;
  const found = Array.from({ length: total }, (_, index) =>
    fields.some((field) => field.words[index]?.match === 'exact'),
  ).filter(Boolean).length;
  if (total > 0 && found === total) return 'split';
  return found > 0 ? 'partial' : 'none';
}

export const judgeListing = (
  localization: string | null,
  role: LocalizationReadRole | null,
  fields: KeywordBreakdownField[],
): KeywordBreakdownListing => ({
  localization,
  role,
  fields,
  placement: placementOf(fields),
});

export const bestPlacement = (
  listings: readonly KeywordBreakdownListing[],
): KeywordPlacement =>
  listings.reduce<KeywordPlacement>(
    (best, listing) =>
      PLACEMENT_STRENGTH[listing.placement] > PLACEMENT_STRENGTH[best]
        ? listing.placement
        : best,
    'none',
  );

export function wordMatches(
  listings: readonly KeywordBreakdownListing[],
  words: readonly string[],
): Map<string, KeywordWordMatch> {
  return new Map(
    words.map((word, index) => [
      word,
      listings
        .flatMap((listing) =>
          listing.fields.map((field) => field.words[index]?.match ?? 'none'),
        )
        .reduce<KeywordWordMatch>(stronger, 'none'),
    ]),
  );
}
