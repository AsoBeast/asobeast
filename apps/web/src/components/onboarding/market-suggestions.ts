import {
  APP_STORE_LOCALIZATION_IDS,
  localizationLanguage,
  type AppStoreLocalization,
  type MarketSuggestion,
  type MarketSuggestionsResult,
} from "@asobeast/shared";
import { pluralize } from "@/lib/format";
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
    : language.toUpperCase();
};

export function languageNames(result: MarketSuggestionsResult): string[] {
  const english = result.languages.filter((language) => language === ENGLISH);
  const others = result.languages.filter((language) => language !== ENGLISH);
  return [...english, ...others].map(languageName);
}

export function marketCostText({ dailyRequests }: MarketSuggestion): string {
  return `${pluralize(dailyRequests.listing, "listing read")} a day, ${dailyRequests.perKeyword} per keyword`;
}

export function selectableSuggestions(
  result: MarketSuggestionsResult,
): MarketSuggestion[] {
  return result.suggestions.filter((suggestion) => !suggestion.tracked);
}
