import type { ListingMarket, Store } from "@asobeast/shared";

export type MarketRatingState = "rated" | "unrated" | "uncaptured";

export interface MarketRatingRow {
  country: string;
  home: boolean;
  state: MarketRatingState;
  ratingAvg: number | null;
  ratingCount: number | null;
  capturedAt: string | null;
}

export interface RatingTotal {
  average: number;
  count: number;
  markets: number;
}

const RATED_STORES: readonly Store[] = ["APP_STORE"];
const MIN_MARKETS_FOR_TOTAL = 2;

export const ratesByMarket = (store: Store): boolean =>
  RATED_STORES.includes(store);

function stateOf(market: ListingMarket): MarketRatingState {
  if (market.capturedAt === null) return "uncaptured";
  return market.ratingAvg == null ? "unrated" : "rated";
}

function toRow(market: ListingMarket): MarketRatingRow {
  return {
    country: market.country,
    home: market.home,
    state: stateOf(market),
    ratingAvg: market.ratingAvg ?? null,
    ratingCount: market.ratingCount ?? null,
    capturedAt: market.capturedAt,
  };
}

function readingOrder(a: MarketRatingRow, b: MarketRatingRow): number {
  if (a.home !== b.home) return a.home ? -1 : 1;
  return (
    (b.ratingCount ?? -1) - (a.ratingCount ?? -1) ||
    a.country.localeCompare(b.country)
  );
}

export function marketRatingRows(
  markets: readonly ListingMarket[],
): MarketRatingRow[] {
  return markets.map(toRow).sort(readingOrder);
}

export function ratingTotal(
  rows: readonly MarketRatingRow[],
): RatingTotal | null {
  const weighted = rows.flatMap(({ ratingAvg, ratingCount }) =>
    ratingAvg !== null && ratingCount !== null && ratingCount > 0
      ? [{ ratingAvg, ratingCount }]
      : [],
  );
  if (weighted.length < MIN_MARKETS_FOR_TOTAL) return null;
  const count = weighted.reduce((sum, row) => sum + row.ratingCount, 0);
  const sum = weighted.reduce(
    (total, row) => total + row.ratingAvg * row.ratingCount,
    0,
  );
  return { average: sum / count, count, markets: weighted.length };
}
