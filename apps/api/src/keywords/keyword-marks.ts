import {
  KEYWORD_MARK_SURFACES,
  type KeywordMarkSegment,
  type KeywordMarkSurface,
  type KeywordWordMatch,
} from '@asobeast/shared';
import type { Surface } from '../metadata/localized-coverage';
import { keywordWords, markWords, wordMatch } from './keyword-breakdown-fields';

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

function findOf(word: string, surfaces: readonly Surface[]): Find | null {
  return surfaces.reduce<Find | null>((best, { field, value }) => {
    if (!isMarkSurface(field) || value.length === 0) return best;
    const match = wordMatch(value, word);
    return match === 'none'
      ? best
      : strongerFind(best, { surface: field, match });
  }, null);
}

function wordsByFind(
  words: readonly string[],
  surfaces: readonly Surface[],
): Map<string, { find: Find; words: string[] }> {
  const groups = new Map<string, { find: Find; words: string[] }>();
  for (const word of words) {
    const find = findOf(word, surfaces);
    if (!find) continue;
    const key = `${find.surface}|${find.match}`;
    const group = groups.get(key) ?? { find, words: [] };
    group.words.push(word);
    groups.set(key, group);
  }
  return groups;
}

function locate(
  text: string,
  groups: Iterable<{ find: Find; words: string[] }>,
): (Find | null)[] {
  const located = Array.from<Find | null>({ length: text.length }).fill(null);
  for (const { find, words } of groups) {
    let at = 0;
    for (const segment of markWords(text, words)) {
      const end = at + segment.text.length;
      if (segment.match === 'exact') {
        for (let index = at; index < end; index += 1) {
          located[index] = strongerFind(located[index], find);
        }
      }
      at = end;
    }
  }
  return located;
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

export function markKeyword(
  text: string,
  surfaces: readonly Surface[],
): KeywordMarkSegment[] | null {
  const groups = wordsByFind(keywordWords(text), surfaces);
  if (groups.size === 0) return null;
  const normalized = text.normalize('NFC');
  const located = locate(normalized, groups.values());
  return located.some(Boolean)
    ? absorbSeparators(segmentsOf(normalized, located))
    : null;
}
