import { RATING_STARS, RatingCounts, RatingStar } from '@asobeast/shared';

const SHARES: Record<RatingStar, number> = {
  '1': 2,
  '2': 3,
  '3': 5,
  '4': 20,
  '5': 70,
};
const PERCENT = 100;

export function starCountsOf(total: number): RatingCounts {
  const counts = {} as RatingCounts;
  let assigned = 0;
  for (const star of RATING_STARS) {
    counts[star] =
      star === '5'
        ? total - assigned
        : Math.floor((total * SHARES[star]) / PERCENT);
    assigned += counts[star];
  }
  return counts;
}

export const starTotal = (counts: RatingCounts): number =>
  RATING_STARS.reduce((sum, star) => sum + counts[star], 0);

export const emptyStar = (
  counts: RatingCounts,
  star: RatingStar,
): RatingCounts => ({
  ...counts,
  [star]: 0,
});

export const omitStar = (
  counts: RatingCounts,
  star: RatingStar,
): Record<string, number> =>
  Object.fromEntries(Object.entries(counts).filter(([key]) => key !== star));
