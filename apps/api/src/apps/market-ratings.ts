import { ListingMarket } from '@asobeast/shared';
import { listingMarket } from './listing';

export interface NewestRating {
  country: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
}

export function withRatings(
  markets: readonly ListingMarket[],
  newest: readonly NewestRating[],
  home: string,
): ListingMarket[] {
  const byMarket = new Map(
    newest.map((row) => [listingMarket(home, row.country), row]),
  );
  return markets.map((market) => {
    const row = byMarket.get(market.country);
    return {
      ...market,
      ratingAvg: row?.ratingAvg ?? null,
      ratingCount: row?.ratingCount ?? null,
    };
  });
}
