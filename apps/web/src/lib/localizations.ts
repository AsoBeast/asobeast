import {
  APP_STORE_LOCALIZATIONS,
  type AppStoreLocalization,
  isAppStoreLocalization,
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

function limitOf(field: "title" | "subtitle" | "keywordField"): number {
  return STORE_FIELD_LIMITS.APP_STORE[field]?.limit ?? 0;
}

export const LOCALIZED_FIELDS_NOTE = `Each localization has its own ${limitOf("title")} character title, ${limitOf("subtitle")} character subtitle and ${limitOf("keywordField")} character keyword field.`;

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

export function draftableLocalizations(
  rows: readonly StorefrontRow[],
): AppStoreLocalization[] {
  const primary = rows.find((row) => row.home)?.primary;
  return [...new Set(rows.flatMap((row) => row.additional))].filter(
    (localization) => localization !== primary,
  );
}

export function localizationName(tag: string): string {
  return isAppStoreLocalization(tag) ? APP_STORE_LOCALIZATIONS[tag] : tag;
}

export function localizedLabel(
  label: string,
  localization?: string | null,
): string {
  return localization ? `${label} · ${localizationName(localization)}` : label;
}
