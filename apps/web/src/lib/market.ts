import type { ListingMarket } from "@asobeast/shared";
import { formatCountry } from "./format";

const isListed = (country: string, markets: readonly ListingMarket[]) =>
  markets.some((market) => market.country === country);

export function resolveMarket(
  requested: string,
  markets: readonly ListingMarket[],
  home: string,
): string {
  return isListed(requested, markets) ? requested : home;
}

export function keywordScope(
  requested: string,
  markets: readonly ListingMarket[],
): string | undefined {
  return isListed(requested, markets) ? requested : undefined;
}

export function queryMarket(market: string, home: string): string | undefined {
  return market === home ? undefined : market;
}

export function marketLabel(market: ListingMarket): string {
  const name = `${market.country.toUpperCase()} · ${formatCountry(market.country)}`;
  return market.home ? `${name} (home)` : name;
}

export function isRefreshable(
  markets: readonly ListingMarket[],
  market: string,
): boolean {
  return markets.find((entry) => entry.country === market)?.tracked !== false;
}

export function resolveLocalization(
  requested: string | null,
  markets: readonly ListingMarket[],
  market: string,
): string | null {
  const captured =
    markets.find((entry) => entry.country === market)?.localizations ?? [];
  return requested !== null && captured.includes(requested) ? requested : null;
}
