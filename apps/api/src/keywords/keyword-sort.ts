import { KeywordSort, TrackedKeywordItem } from '@asobeast/shared';

const SORT_VALUE: Record<
  KeywordSort,
  (item: TrackedKeywordItem) => number | null
> = {
  opportunity: (item) => item.opportunity,
  traffic: (item) => item.traffic,
  difficulty: (item) => item.difficulty,
  position: (item) => item.latestPosition,
  volatility: (item) => item.serpVolatility7d,
};

export function sortTracked(
  items: TrackedKeywordItem[],
  sort?: KeywordSort,
): TrackedKeywordItem[] {
  if (!sort) {
    return items;
  }
  const value = SORT_VALUE[sort];
  const ascending = sort === 'position';
  return [...items].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null && bv === null) {
      return 0;
    }
    if (av === null) {
      return 1;
    }
    if (bv === null) {
      return -1;
    }
    return ascending ? av - bv : bv - av;
  });
}
