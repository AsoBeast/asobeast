import {
  COUNTRY_PATTERN,
  isStorefront,
  type Store,
  UnknownStorefrontError,
} from "@asobeast/shared";

export const COUNTRY_OPTIONS = [
  "us",
  "gb",
  "de",
  "fr",
  "es",
  "it",
  "nl",
  "pl",
  "br",
  "mx",
  "jp",
  "kr",
  "cn",
  "in",
  "au",
  "ca",
];

export const OTHER = "other";

export function marketError(store: Store, country: string): string | null {
  if (!COUNTRY_PATTERN.test(country)) {
    return "Market must be a two letter code, e.g. us";
  }
  return isStorefront(store, country)
    ? null
    : new UnknownStorefrontError(store, country).message;
}
