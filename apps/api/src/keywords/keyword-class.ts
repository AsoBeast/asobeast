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
  categories: readonly BrandName[];
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
  left.size === right.size &&
  containsName([...left], right) &&
  containsName([...right], left);

const isName = (name: BrandName | null): name is BrandName => name !== null;

export function brandProfileOf(input: {
  title: string | null;
  developer: string | null;
  competitorTitles: readonly (string | null)[];
}): BrandProfile {
  const named = input.competitorTitles
    .map((title) => (title === null ? null : brandNameOf(title)))
    .filter(isName);
  const shared = (name: BrandName) =>
    named.filter((other) => sameName(name, other)).length >=
    CATEGORY_NAME_COMPETITORS;
  return {
    own: [
      input.title === null ? null : brandNameOf(input.title),
      developerNameOf(input.developer),
    ].filter(isName),
    competitors: named.filter((name) => !shared(name)),
    categories: named.filter(shared),
  };
}

export function profileForListing(
  profile: BrandProfile,
  listing: { words: readonly string[]; titles: readonly string[] },
): BrandProfile {
  const marketNames = listing.titles.map(brandNameOf).filter(isName);
  const listed = (name: BrandName) => containsName(listing.words, name);
  return {
    own: [...profile.own, ...marketNames],
    competitors: profile.competitors.filter((name) => !listed(name)),
    categories: [...profile.categories, ...profile.competitors.filter(listed)],
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
  if (overruledBySerp(keyword)) return 'generic';
  const holds = (name: BrandName) => containsName(words, name);
  if (profile.own.some(holds)) return 'ownBrand';
  if (profile.competitors.some(holds)) return 'competitorBrand';
  if (profile.categories.some(holds)) return 'generic';
  return keyword.flags.includes('brand') ? 'competitorBrand' : 'generic';
}
