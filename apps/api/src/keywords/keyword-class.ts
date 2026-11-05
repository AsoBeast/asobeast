import { KeywordClass, SerpFlag } from '@asobeast/shared';
import { isUnsegmented } from '../common/text/scripts';
import { sameWord } from '../scoring/plurals';
import {
  BrandName,
  brandNameOf,
  contentWords,
  developerNameOf,
} from './brand-words';

export const GENERIC_SERP_RELEVANCE = 0.5;
export const CATEGORY_NAME_COMPETITORS = 2;

export interface BrandProfile {
  own: readonly BrandName[];
  competitors: readonly BrandName[];
}

export interface ClassifiableKeyword {
  text: string;
  flags: readonly SerpFlag[];
  serpRelevance: number | null;
}

const wordMatches = (word: string, brandWord: string): boolean =>
  isUnsegmented(brandWord)
    ? word.includes(brandWord)
    : sameWord(word, brandWord);

const containsName = (words: readonly string[], name: BrandName): boolean =>
  [...name].every((brandWord) =>
    words.some((word) => wordMatches(word, brandWord)),
  );

const sameName = (left: BrandName, right: BrandName): boolean =>
  left.size === right.size && [...left].every((word) => right.has(word));

const isName = (name: BrandName | null): name is BrandName => name !== null;

export function brandProfileOf(input: {
  title: string | null;
  developer: string | null;
  competitorTitles: readonly (string | null)[];
}): BrandProfile {
  const named = input.competitorTitles
    .map((title) => (title === null ? null : brandNameOf(title)))
    .filter(isName);
  return {
    own: [
      input.title === null ? null : brandNameOf(input.title),
      developerNameOf(input.developer),
    ].filter(isName),
    competitors: named.filter(
      (name) =>
        named.filter((other) => sameName(name, other)).length <
        CATEGORY_NAME_COMPETITORS,
    ),
  };
}

export function profileForListing(
  profile: BrandProfile,
  listingWords: readonly string[],
): BrandProfile {
  return {
    own: profile.own,
    competitors: profile.competitors.filter(
      (name) => !containsName(listingWords, name),
    ),
  };
}

const overruledBySerp = ({
  flags,
  serpRelevance,
}: ClassifiableKeyword): boolean =>
  !flags.includes('brand') &&
  serpRelevance !== null &&
  serpRelevance >= GENERIC_SERP_RELEVANCE;

export function classifyKeyword(
  keyword: ClassifiableKeyword,
  profile: BrandProfile,
): KeywordClass {
  const words = contentWords(keyword.text);
  if (words.length === 0 || overruledBySerp(keyword)) return 'generic';
  if (profile.own.some((name) => containsName(words, name))) return 'ownBrand';
  const named = profile.competitors.some((name) => containsName(words, name));
  if (named || keyword.flags.includes('brand')) return 'competitorBrand';
  return 'generic';
}
