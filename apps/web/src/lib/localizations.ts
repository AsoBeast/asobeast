import {
  type AppStoreLocalization,
  STORE_FIELD_LIMITS,
  storefrontLocalizations,
} from "@asobeast/shared";
import enFormat from "../../messages/en/format.json";
import enLanguages from "../../messages/en/languages.json";
import zhFormat from "../../messages/zh-CN/format.json";
import zhLanguages from "../../messages/zh-CN/languages.json";
import { formatMessage } from "@/i18n/format-message";
import type { Locale } from "./locale";

const APP_STORE_LOCALIZATION_NAMES = {
  en: enLanguages.appStore,
  "zh-CN": zhLanguages.appStore,
} as const;

const LOCALIZED_FIELDS_NOTES = {
  en: enFormat.localizations.fieldsNote,
  "zh-CN": zhFormat.localizations.fieldsNote,
} as const;

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

export function localizedFieldsNote(locale: Locale = "en"): string {
  return formatMessage(LOCALIZED_FIELDS_NOTES[locale], locale, {
    title: limitOf("title"),
    subtitle: limitOf("subtitle"),
    keywordField: limitOf("keywordField"),
  });
}

export const LOCALIZED_FIELDS_NOTE = localizedFieldsNote();

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
  return localizationNameInLocale(tag);
}

export function localizationNameInLocale(
  tag: string,
  locale: Locale = "en",
): string {
  const names: Readonly<Record<string, string>> =
    APP_STORE_LOCALIZATION_NAMES[locale];
  return Object.hasOwn(names, tag) ? names[tag] : tag;
}

export function localizedLabel(
  label: string,
  localization?: string | null,
  locale: Locale = "en",
): string {
  return localization
    ? `${label} · ${localizationNameInLocale(localization, locale)}`
    : label;
}
