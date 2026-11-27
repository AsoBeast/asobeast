import type { ListingMarket } from "@asobeast/shared";
import enFormat from "../../messages/en/format.json";
import zhFormat from "../../messages/zh-CN/format.json";
import { formatMessage } from "@/i18n/format-message";
import { formatCountryInLocale } from "./format";
import type { Locale } from "./locale";

const HOME_LABELS = {
  en: enFormat.market.home,
  "zh-CN": zhFormat.market.home,
} as const;

const isListed = (country: string, markets: readonly ListingMarket[]) =>
  markets.some((market) => market.country === country);

export function resolveMarket(
  requested: string,
  markets: readonly ListingMarket[],
  home: string,
): string {
  return isListed(requested, markets) ? requested : home;
}

export const offersMarkets = (markets: readonly ListingMarket[]) =>
  markets.length > 1;

export function keywordScope(
  requested: string,
  markets: readonly ListingMarket[],
): string | undefined {
  return offersMarkets(markets) && isListed(requested, markets)
    ? requested
    : undefined;
}

export function queryMarket(market: string, home: string): string | undefined {
  return market === home ? undefined : market;
}

export function marketLabel(
  market: ListingMarket,
  locale: Locale = "en",
): string {
  const name = `${market.country.toUpperCase()} · ${formatCountryInLocale(market.country, locale)}`;
  return market.home
    ? formatMessage(HOME_LABELS[locale], locale, { label: name })
    : name;
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
