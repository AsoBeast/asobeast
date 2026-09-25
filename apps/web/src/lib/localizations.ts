import {
  type AppStoreLocalization,
  KEYWORD_FIELD_BYTE_LIMIT,
  STORE_FIELD_LIMITS,
  storefrontLocalizations,
} from "@asobeast/shared";

export const APPLE_LOCALIZATIONS_URL =
  "https://developer.apple.com/help/app-store-connect/reference/app-store-localizations/";

export interface StorefrontRow {
  country: string;
  home: boolean;
  primary: AppStoreLocalization;
  additional: readonly AppStoreLocalization[];
}

function limitOf(field: "title" | "subtitle"): number {
  return STORE_FIELD_LIMITS.APP_STORE[field]?.limit ?? 0;
}

export const LOCALIZED_FIELDS_NOTE = `Each localization has its own ${limitOf("title")} character title, ${limitOf("subtitle")} character subtitle and ${KEYWORD_FIELD_BYTE_LIMIT} byte keyword field.`;

export function storefrontRows(
  home: string,
  markets: readonly string[],
): StorefrontRow[] {
  return [...new Set([home, ...markets])].flatMap((country) => {
    const localizations = storefrontLocalizations(country);
    return localizations === null
      ? []
      : [{ country, home: country === home, ...localizations }];
  });
}

export function extraRoom(count: number, country: string): string {
  const one = count === 1;
  const localizations = one ? "localization" : "localizations";
  const fields = one
    ? "title, subtitle and keyword field"
    : "titles, subtitles and keyword fields";
  return `${count} more ${localizations}: ${count} more ${fields} that ${country.toUpperCase()} search reads`;
}
