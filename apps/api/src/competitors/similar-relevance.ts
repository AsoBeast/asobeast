import { normalizeText } from '@asobeast/shared';
import { containsTerm } from '../common/text/scripts';
import { extractCandidates } from '../keywords/extraction';
import { ListingText } from '../keywords/listing-texts';
import { SearchItem } from '../store-providers/types';

const SHARE_OF_BEST_MATCH = 0.5;

export function listingTerms({
  title,
  subtitle,
  summary,
  languages,
}: ListingText): string[] {
  return extractCandidates(
    { title, subtitle: subtitle ?? undefined, summary: summary ?? undefined },
    languages,
  ).map((candidate) => candidate.text);
}

const sharedTerms = (terms: readonly string[], item: SearchItem): number => {
  const text = normalizeText(`${item.title} ${item.summary ?? ''}`);
  return terms.filter((term) => containsTerm(text, term)).length;
};

export function closestSimilar(
  terms: readonly string[],
  similar: readonly SearchItem[],
): SearchItem[] {
  if (terms.length === 0) return [...similar];
  const scored = similar.map((item) => ({
    item,
    shared: sharedTerms(terms, item),
  }));
  const best = Math.max(0, ...scored.map(({ shared }) => shared));
  const floor = Math.max(1, Math.ceil(best * SHARE_OF_BEST_MATCH));
  return scored
    .filter(({ shared }) => shared >= floor)
    .sort((a, b) => b.shared - a.shared)
    .map(({ item }) => item);
}
