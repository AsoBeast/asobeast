import type { ListingMarket } from "@asobeast/shared";
import { formatCountry } from "./format";

export function resolveMarket(
  requested: string,
  markets: readonly ListingMarket[],
  home: string,
): string {
  return markets.some((market) => market.country === requested)
    ? requested
    : home;
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
