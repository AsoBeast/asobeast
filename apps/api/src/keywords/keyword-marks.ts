import {
  KEYWORD_MARK_SURFACES,
  type KeywordMarkSegment,
  type KeywordMarkSurface,
  type KeywordWordMatch,
} from '@asobeast/shared';
import { Store } from '@prisma/client';
import {
  CoverageSources,
  keywordSurfaces,
} from '../metadata/keyword-coverage-judge';
import type { Surface } from '../metadata/localized-coverage';
import {
  keywordWords,
  markWords,
  wordMatcher,
} from './keyword-breakdown-fields';

interface Find {
  surface: KeywordMarkSurface;
  match: Exclude<KeywordWordMatch, 'none'>;
}

const isMarkSurface = (field: string): field is KeywordMarkSurface =>
  KEYWORD_MARK_SURFACES.some((surface) => surface === field);

const strength = ({ surface, match }: Find): number =>
  (match === 'exact' ? KEYWORD_MARK_SURFACES.length : 0) -
  KEYWORD_MARK_SURFACES.indexOf(surface);

const strongerFind = (current: Find | null, next: Find): Find =>
  current && strength(current) >= strength(next) ? current : next;

interface MarkSurface {
  surface: KeywordMarkSurface;
  matchOf: (word: string) => KeywordWordMatch;
}

const markSurfaces = (surfaces: readonly Surface[]): MarkSurface[] =>
  surfaces.flatMap(({ field, value }) =>
    isMarkSurface(field) && value.length > 0
      ? [{ surface: field, matchOf: wordMatcher(value) }]
      : [],
  );

function findOf(word: string, surfaces: readonly MarkSurface[]): Find | null {
  return surfaces.reduce<Find | null>((best, { surface, matchOf }) => {
    const match = matchOf(word);
    return match === 'none' ? best : strongerFind(best, { surface, match });
  }, null);
}

type WordFinder = (word: string) => Find | null;

interface Located {
  find: Find;
  span: number;
}

const claims = (current: Located | null, next: Located): boolean =>
  current === null ||
  next.span > current.span ||
  (next.span === current.span &&
    strongerFind(current.find, next.find) === next.find);

function claimSpan(
  located: (Located | null)[],
  start: number,
  next: Located,
): void {
  for (let index = start; index < start + next.span; index += 1) {
    if (claims(located[index], next)) located[index] = next;
  }
}

function locate(
  text: string,
  words: readonly string[],
  findWord: WordFinder,
): (Find | null)[] {
  const located = Array.from<Located | null>({ length: text.length }).fill(
    null,
  );
  for (const word of words) {
    const find = findWord(word);
    if (!find) continue;
    let at = 0;
    for (const segment of markWords(text, [word])) {
      if (segment.match === 'exact') {
        claimSpan(located, at, { find, span: segment.text.length });
      }
      at += segment.text.length;
    }
  }
  return located.map((entry) => entry?.find ?? null);
}

const sameFind = (a: KeywordMarkSegment, b: KeywordMarkSegment) =>
  a.surface === b.surface && a.match === b.match;

const segmentOf = (text: string, find: Find | null): KeywordMarkSegment =>
  find ? { text, ...find } : { text, surface: null };

function segmentsOf(
  text: string,
  located: readonly (Find | null)[],
): KeywordMarkSegment[] {
  const segments: KeywordMarkSegment[] = [];
  located.forEach((find, index) => {
    const next = segmentOf(text[index], find);
    const last = segments.at(-1);
    if (last && sameFind(last, next)) last.text += next.text;
    else segments.push(next);
  });
  return segments;
}

const isSeparator = (segment: KeywordMarkSegment) =>
  segment.surface === null && segment.text.trim() === '';

function absorbSeparators(
  segments: readonly KeywordMarkSegment[],
): KeywordMarkSegment[] {
  const merged: KeywordMarkSegment[] = [];
  segments.forEach((segment, index) => {
    const last = merged.at(-1);
    const next = segments[index + 1];
    const joins =
      last?.surface &&
      (sameFind(last, segment) ||
        (isSeparator(segment) && next !== undefined && sameFind(last, next)));
    if (last && joins) last.text += segment.text;
    else merged.push({ ...segment });
  });
  return merged;
}

function marksOn(
  text: string,
  findWord: WordFinder,
): KeywordMarkSegment[] | null {
  const normalized = text.normalize('NFC');
  const located = locate(normalized, keywordWords(text), findWord);
  return located.some(Boolean)
    ? absorbSeparators(segmentsOf(normalized, located))
    : null;
}

export const markKeyword = (
  text: string,
  surfaces: readonly Surface[],
): KeywordMarkSegment[] | null => {
  const prepared = markSurfaces(surfaces);
  return marksOn(text, (word) => findOf(word, prepared));
};

export type KeywordMarker = (keyword: {
  country: string;
  text: string;
}) => KeywordMarkSegment[] | null;

function rememberedFinder(surfaces: readonly MarkSurface[]): WordFinder {
  const finds = new Map<string, Find | null>();
  return (word) => {
    if (!finds.has(word)) finds.set(word, findOf(word, surfaces));
    return finds.get(word) ?? null;
  };
}

export function keywordMarker(
  app: { store: Store; country: string },
  sources: CoverageSources,
): KeywordMarker {
  const finders = new Map<string, WordFinder>();
  const finderOf = (country: string): WordFinder => {
    const known = finders.get(country);
    if (known) return known;
    const { surfaces, localized } = keywordSurfaces(app, country, sources);
    const finder = rememberedFinder(
      markSurfaces([
        ...surfaces,
        ...localized.flatMap((entry) => entry.surfaces),
      ]),
    );
    finders.set(country, finder);
    return finder;
  };
  return ({ country, text }) => marksOn(text, finderOf(country));
}
