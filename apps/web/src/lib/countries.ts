import type { MessageTranslator } from "@/i18n/translator";
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

export function marketError(
  store: Store,
  country: string,
  translator?: MessageTranslator,
): string | null {
  if (!COUNTRY_PATTERN.test(country)) {
    return translator
      ? translator("marketCode")
      : "Market must be a two letter code, e.g. us";
  }
  if (isStorefront(store, country)) return null;
  if (!translator) return new UnknownStorefrontError(store, country).message;
  const name = store === "APP_STORE" ? "App Store" : "Google Play";
  return translator("unknownMarket", {
    store: name,
    code: country.toUpperCase(),
  });
}
