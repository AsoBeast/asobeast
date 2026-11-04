import { tokenize } from '@asobeast/shared';
import { usableIn } from '../keywords/extraction';
import { functionWordTest } from '../keywords/function-words';

export interface PopularityTerm {
  term: string;
  popularity: number;
}

const byPopularity = (a: PopularityTerm, b: PopularityTerm): number =>
  b.popularity - a.popularity ||
  (a.term < b.term ? -1 : a.term > b.term ? 1 : 0);

export function overlappingTerms(
  terms: readonly PopularityTerm[],
  listingTexts: readonly string[],
  languages: readonly string[],
): PopularityTerm[] {
  const isUsable = usableIn(functionWordTest(languages));
  const listingWords = new Set(listingTexts.flatMap(tokenize).filter(isUsable));
  return terms
    .filter(({ term }) => tokenize(term).some((word) => listingWords.has(word)))
    .sort(byPopularity);
}
