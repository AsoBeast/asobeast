import {
  isStopword,
  listingSegments,
  searchKey,
  tokenize,
} from '@asobeast/shared';
import { DEVELOPER_SUFFIXES } from '../scoring/serp-flags';

export const BRAND_NAME_MAX_WORDS = 3;

const SPACED_DASH = /\s[-–—]\s/u;

export type BrandName = ReadonlySet<string>;

export const contentWords = (text: string): string[] =>
  tokenize(text)
    .filter((word) => !isStopword(word))
    .map(searchKey);

const asName = (words: string[]): BrandName | null =>
  words.length > 0 && words.length <= BRAND_NAME_MAX_WORDS
    ? new Set(words)
    : null;

export function brandNameOf(title: string): BrandName | null {
  const [lead = ''] = title.split(SPACED_DASH);
  const [first = '', ...rest] = listingSegments(lead);
  const separated =
    lead !== title || rest.some((segment) => tokenize(segment).length > 0);
  const oneWord = tokenize(title).length === 1;
  return separated || oneWord ? asName(contentWords(first)) : null;
}

export function developerNameOf(developer: string | null): BrandName | null {
  const core = tokenize(developer ?? '').filter(
    (word) => !DEVELOPER_SUFFIXES.has(word),
  );
  return asName(contentWords(core.join(' ')));
}
