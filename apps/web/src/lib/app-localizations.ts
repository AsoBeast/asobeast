import {
  APP_STORE_LOCALIZATIONS,
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  parseKeywordField,
  storefrontsReading,
  type AppLocalizationItem,
  type AppLocalizationOrigin,
  type AppLocalizationsResult,
  type AppStoreLocalization,
  type LocalizationReadRole,
  type LocalizedKeywordFieldResult,
} from "@asobeast/shared";
import { formatCountry, formatList, pluralize } from "@/lib/format";

export const LOCALIZATIONS_SECTION_ID = "app-localizations";

export const READ_ROLE_LABELS: Record<LocalizationReadRole, string> = {
  default: "Default",
  additional: "Also",
};

const STOREFRONT_SUGGESTIONS = 5;

export interface LocalizationGridRow {
  localization: AppStoreLocalization;
  origin: AppLocalizationOrigin;
  cells: (LocalizationReadRole | null)[];
}

export interface LocalizationGrid {
  markets: string[];
  rows: LocalizationGridRow[];
}

export function localizationMatrix(
  result: AppLocalizationsResult,
): LocalizationGrid | null {
  if (result.markets.length < 2 && result.localizations.length < 2) {
    return null;
  }
  return {
    markets: result.markets,
    rows: result.localizations.map((item) => ({
      localization: item.localization,
      origin: item.origin,
      cells: result.markets.map(
        (market) =>
          item.readBy.find((reader) => reader.country === market)?.role ?? null,
      ),
    })),
  };
}

export const editLocalizationHref = (
  id: string,
  localization: AppStoreLocalization,
): string =>
  `/apps/${id}/metadata?fieldLocale=${localization}#${LOCALIZATIONS_SECTION_ID}`;

export function openLocalization(
  items: readonly AppLocalizationItem[],
  requested: AppStoreLocalization | null,
): string {
  if (items.length === 1) return items[0].localization;
  return (
    items.find((item) => item.localization === requested)?.localization ?? ""
  );
}

export interface KeywordFieldDraft {
  phrases: string[];
  used: number;
  over: number;
  storedAs: string | null;
  changed: boolean;
}

export function keywordFieldDraft(
  text: string,
  stored: readonly string[],
): KeywordFieldDraft {
  const { phrases } = parseKeywordField(text);
  const used = keywordFieldChars(phrases);
  const joined = phrases.join(",");
  return {
    phrases,
    used,
    over: Math.max(0, used - KEYWORD_FIELD_CHAR_LIMIT),
    storedAs: joined !== "" && joined !== text ? joined : null,
    changed: joined !== stored.join(","),
  };
}

export function savedDescription(result: LocalizedKeywordFieldResult): string {
  const { phrases } = result.localization;
  if (phrases.length === 0) return "The field is empty.";
  const tracked =
    result.trackedIn.length === 0
      ? "Its phrases are not tracked in any market"
      : `${pluralize(phrases.length, "phrase")} tracked in ${formatList(result.trackedIn.map(formatCountry))}`;
  return result.duplicatesRemoved > 0
    ? `${tracked} · ${pluralize(result.duplicatesRemoved, "duplicate")} removed`
    : tracked;
}

const byHomeThenName = (
  left: AppLocalizationItem,
  right: AppLocalizationItem,
): number =>
  Number(right.origin === "home") - Number(left.origin === "home") ||
  APP_STORE_LOCALIZATIONS[left.localization].localeCompare(
    APP_STORE_LOCALIZATIONS[right.localization],
    "en",
  );

export function upsertLocalization(
  result: AppLocalizationsResult,
  item: AppLocalizationItem,
): AppLocalizationsResult {
  const others = result.localizations.filter(
    (existing) => existing.localization !== item.localization,
  );
  return { ...result, localizations: [...others, item].sort(byHomeThenName) };
}

export function readingStorefrontNames(
  localization: AppStoreLocalization,
): string[] {
  return storefrontsReading(
    localization,
    Object.keys(APP_STORE_STOREFRONT_LOCALIZATIONS),
  )
    .slice(0, STOREFRONT_SUGGESTIONS)
    .map(formatCountry);
}
