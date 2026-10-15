import {
  APP_STORE_LOCALIZATION_IDS,
  APP_STORE_LOCALIZATIONS,
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  keywordFieldLocalizations,
  isStorefront,
  tokenize,
  parseKeywordField,
  storefrontsReading,
  type AppDetail,
  type AppLocalizationItem,
  type AppLocalizationOrigin,
  type AppLocalizationsResult,
  type AppStoreLocalization,
  type KeywordFieldSavePreview,
  type KeywordImportQuota,
  type LocalizationReader,
  type LocalizationReadRole,
  type LocalizedKeywordFieldResult,
  type MarketLocalizationRead,
  type MarketSuggestionsResult,
} from "@asobeast/shared";
import {
  formatCountry,
  formatList,
  formatNumber,
  pluralize,
} from "@/lib/format";
import { hasNoCapacity } from "@/lib/quota-usage";

export const LOCALIZATIONS_SECTION_ID = "app-localizations";

export const READ_ROLE_LABELS: Record<LocalizationReadRole, string> = {
  default: "Default",
  additional: "Also",
};

const STOREFRONT_SUGGESTIONS = 5;

export const SUGGESTED_COLUMNS = 3;

export interface LocalizationGridRow {
  localization: AppStoreLocalization;
  origin: AppLocalizationOrigin;
  cells: (LocalizationReadRole | null)[];
}

export interface LocalizationGrid {
  markets: string[];
  suggested: string[];
  rows: LocalizationGridRow[];
}

export interface SuggestedMarketHint {
  text: string;
  link: string;
  href: string;
}

function readRole(
  country: string,
  localization: AppStoreLocalization,
): LocalizationReadRole | null {
  const index = keywordFieldLocalizations(country).indexOf(localization);
  if (index < 0) return null;
  return index === 0 ? "default" : "additional";
}

export function suggestedColumns(
  result: AppLocalizationsResult,
  suggestions: MarketSuggestionsResult | null,
): string[] {
  const shipped = new Set(
    result.localizations.map((item) => item.localization),
  );
  return (suggestions?.suggestions ?? [])
    .filter(
      (suggestion) =>
        suggestion.role === "default" &&
        !suggestion.tracked &&
        shipped.has(suggestion.localization) &&
        !result.markets.includes(suggestion.country),
    )
    .slice(0, SUGGESTED_COLUMNS)
    .map((suggestion) => suggestion.country);
}

export function localizationMatrix(
  result: AppLocalizationsResult,
  suggestions: MarketSuggestionsResult | null = null,
): LocalizationGrid | null {
  if (result.markets.length < 2 && result.localizations.length < 2) {
    return null;
  }
  const suggested = suggestedColumns(result, suggestions);
  return {
    markets: result.markets,
    suggested,
    rows: result.localizations.map((item) => ({
      localization: item.localization,
      origin: item.origin,
      cells: [
        ...result.markets.map(
          (market) =>
            item.readBy.find((reader) => reader.country === market)?.role ??
            null,
        ),
        ...suggested.map((country) => readRole(country, item.localization)),
      ],
    })),
  };
}

export function suggestedHint(
  id: string,
  suggested: readonly string[],
): SuggestedMarketHint | null {
  const [country] = suggested;
  if (country === undefined) return null;
  const languages = keywordFieldLocalizations(country)
    .filter((localization) => !localization.startsWith("en"))
    .map((localization) => APP_STORE_LOCALIZATIONS[localization]);
  return {
    text: `${formatCountry(country)} reads ${formatList(languages)}.`,
    link: `Add ${country.toUpperCase()} as a market`,
    href: `/apps/${id}/keywords?country=${country}`,
  };
}

export const editLocalizationHref = (
  id: string,
  localization: AppStoreLocalization,
): string =>
  `/apps/${id}/metadata?fieldLocale=${localization}#${LOCALIZATIONS_SECTION_ID}`;

export const localizationsSectionHref = (id: string): string =>
  `/apps/${id}/metadata#${LOCALIZATIONS_SECTION_ID}`;

export function uniqueWordCount(
  reads: readonly MarketLocalizationRead[],
): number {
  return new Set(reads.flatMap((read) => read.phrases.flatMap(tokenize))).size;
}

export function unshippedReads(
  reads: readonly MarketLocalizationRead[],
): MarketLocalizationRead[] {
  return reads.filter((read) => !read.shipped);
}

export function ownsKeywordFields(
  app: Pick<AppDetail, "store" | "isCompetitor">,
): boolean {
  return app.store === "APP_STORE" && app.isCompetitor !== true;
}

export function hasMarketReads(home: string, market: string): boolean {
  return market === home || isStorefront("APP_STORE", market);
}

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

export interface SaveCost {
  keywordMarkets: number;
  dailyRequests: number;
}

export interface SaveQuotaNotice {
  text: string;
  over: boolean;
  upgrade: boolean;
}

export function shouldConfirmSave(preview: KeywordFieldSavePreview): boolean {
  return (
    preview.added.length > 0 ||
    preview.dropped.length > 0 ||
    preview.markets.some((market) => market.newPhrases.length > 0)
  );
}

export function selectedCost(
  preview: KeywordFieldSavePreview,
  trackIn: readonly string[],
): SaveCost {
  return preview.markets
    .filter((market) => trackIn.includes(market.country))
    .reduce<SaveCost>(
      (sum, market) => ({
        keywordMarkets: sum.keywordMarkets + market.keywordMarkets,
        dailyRequests: sum.dailyRequests + market.dailyRequests,
      }),
      { keywordMarkets: 0, dailyRequests: 0 },
    );
}

export function tracksNewPhrases(
  preview: KeywordFieldSavePreview,
  trackIn: readonly string[],
): boolean {
  return preview.markets.some(
    (market) =>
      trackIn.includes(market.country) && market.newPhrases.length > 0,
  );
}

export function saveCostText(cost: SaveCost): string {
  if (cost.keywordMarkets === 0) return "Tracks nothing new.";
  return `Adds ${pluralize(cost.keywordMarkets, "keyword market")} and about ${pluralize(cost.dailyRequests, "store request")} a day.`;
}

export function saveQuotaNotice(
  quota: KeywordImportQuota | null,
  cost: SaveCost,
): SaveQuotaNotice | null {
  if (quota === null || quota.limit === null) return null;
  const after = quota.used + cost.keywordMarkets;
  const empty = hasNoCapacity(quota);
  const over = cost.keywordMarkets > 0 && (empty || after > quota.limit);
  return {
    text: empty
      ? "Your plan includes no keyword markets."
      : `${formatNumber(after)} of ${formatNumber(quota.limit)} keyword markets after saving.`,
    over,
    upgrade: over && quota.upgradeTo !== null,
  };
}

export function addedSentence(preview: KeywordFieldSavePreview): string | null {
  if (preview.added.length === 0) return null;
  return `${pluralize(preview.added.length, "new phrase")}: ${preview.added.join(", ")}`;
}

export function droppedSentence(
  preview: KeywordFieldSavePreview,
): string | null {
  const count = preview.dropped.length;
  if (count === 0) return null;
  if (preview.markets.length === 0) {
    return count === 1
      ? "1 phrase leaves the field"
      : `${formatNumber(count)} phrases leave the field`;
  }
  const where = formatList(
    preview.markets.map((market) => formatCountry(market.country)),
  );
  return count === 1
    ? `1 phrase leaves the field and stops being tracked as a keyword field phrase in ${where}`
    : `${formatNumber(count)} phrases leave the field and stop being tracked as keyword field phrases in ${where}`;
}

export interface AddableLocalization {
  localization: AppStoreLocalization;
  readIn: string[];
}

export interface AddableGroups {
  read: AddableLocalization[];
  other: AddableLocalization[];
}

export function addableGroups(
  items: readonly AppLocalizationItem[],
  markets: readonly string[],
): AddableGroups {
  const shipped = new Set(items.map((item) => item.localization));
  const candidates = APP_STORE_LOCALIZATION_IDS.filter(
    (localization) => !shipped.has(localization),
  ).map((localization) => ({
    localization,
    readIn: markets.filter((market) =>
      keywordFieldLocalizations(market).includes(localization),
    ),
  }));
  return {
    read: candidates.filter((candidate) => candidate.readIn.length > 0),
    other: candidates.filter((candidate) => candidate.readIn.length === 0),
  };
}

export interface UnlistedRead {
  localization: AppStoreLocalization;
  readIn: LocalizationReader[];
}

const readByDefault = (read: UnlistedRead): boolean =>
  read.readIn.some((reader) => reader.role === "default");

export function unlistedReads(result: AppLocalizationsResult): UnlistedRead[] {
  const reads = addableGroups(result.localizations, result.markets).read.map(
    ({ localization, readIn }) => ({
      localization,
      readIn: readIn.flatMap((country) => {
        const role = readRole(country, localization);
        return role ? [{ country, role, home: country === result.home }] : [];
      }),
    }),
  );
  return [
    ...reads.filter(readByDefault),
    ...reads.filter((read) => !readByDefault(read)),
  ];
}

export function withoutLocalization(
  result: AppLocalizationsResult,
  localization: AppStoreLocalization,
): AppLocalizationsResult {
  return {
    ...result,
    localizations: result.localizations.filter(
      (item) => item.localization !== localization,
    ),
  };
}

export function removeDescription(item: AppLocalizationItem): string {
  if (item.readBy.length === 0) {
    return "Its keyword field is deleted. Phrases you track for another reason stay.";
  }
  const where = formatList(
    item.readBy.map((reader) => formatCountry(reader.country)),
  );
  return `Its keyword field is deleted. Its phrases stop being tracked as keyword field phrases in ${where}; phrases you track for another reason stay.`;
}
