import {
  APP_STORE_LOCALIZATION_IDS,
  localizationLanguage,
  MARKET_SEED_LIMIT,
  type AppStoreLocalization,
  type MarketSuggestion,
  type MarketSuggestionsResult,
  type Store,
} from "@asobeast/shared";
import { pluralize } from "@/lib/format";
import { LANGUAGE_NAMES } from "@/lib/language-names";
import { localizationName } from "@/lib/localizations";

export const MARKET_COST_GUIDE =
  "https://docs.asobeast.com/concepts/countries#what-does-a-market-cost";

const ENGLISH = "en";

export interface SuggestionGroup {
  localization: AppStoreLocalization;
  name: string;
  markets: MarketSuggestion[];
}

export function groupSuggestions(
  result: MarketSuggestionsResult,
): SuggestionGroup[] {
  const groups = new Map<AppStoreLocalization, MarketSuggestion[]>();
  for (const suggestion of result.suggestions) {
    groups.set(suggestion.localization, [
      ...(groups.get(suggestion.localization) ?? []),
      suggestion,
    ]);
  }
  return [...groups].map(([localization, markets]) => ({
    localization,
    name: localizationName(localization),
    markets,
  }));
}

const languageName = (language: string): string => {
  const localization = APP_STORE_LOCALIZATION_IDS.find(
    (tag) => localizationLanguage(tag) === language,
  );
  return localization
    ? localizationName(localization).replace(/ \(.*\)$/, "")
    : (LANGUAGE_NAMES[language] ?? language.toUpperCase());
};

export function languageNames(result: MarketSuggestionsResult): string[] {
  const english = result.languages.filter((language) => language === ENGLISH);
  const others = result.languages.filter((language) => language !== ENGLISH);
  return [...english, ...others].map(languageName);
}

const MARKET_READS: Record<Store, string> = {
  APP_STORE:
    "one listing read a day for the app and for every competitor, one more for each localization captured there,",
  GOOGLE_PLAY: "one listing read a day for the app and for every competitor,",
};

const SEEDING: Record<Store, string> = {
  APP_STORE: ` Seeding tracks up to ${MARKET_SEED_LIMIT} keywords from the market's own title and subtitle; each one adds a daily search.`,
  GOOGLE_PLAY: "",
};

export function marketCostSummary(store: Store): string {
  return `A market adds ${MARKET_READS[store]} and one search a day for every keyword tracked there.${SEEDING[store]}`;
}

export function marketCostText({ dailyRequests }: MarketSuggestion): string {
  return `${pluralize(dailyRequests.listing, "listing read")} a day, ${dailyRequests.perKeyword} per keyword`;
}
