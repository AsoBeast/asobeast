import {
  APP_STORE_LOCALIZATION_IDS,
  localizationLanguage,
  MARKET_SEED_LIMIT,
  type AppStoreLocalization,
  type MarketSuggestion,
  type MarketSuggestionsResult,
  type Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enSetup from "../../../messages/en/setup.json";
import type { MessageTranslator } from "@/i18n/translator";
import { languageName } from "@/lib/language-names";
import { localizationNameInLocale } from "@/lib/localizations";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "setup",
  messages: { setup: enSetup },
});

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
  locale: Locale = "en",
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
    name: localizationNameInLocale(localization, locale),
    markets,
  }));
}

const languageNameOf = (language: string, locale: Locale): string => {
  const localization = APP_STORE_LOCALIZATION_IDS.find(
    (tag) => localizationLanguage(tag) === language,
  );
  if (!localization) {
    const named = languageName(language, locale);
    return named === language ? language.toUpperCase() : named;
  }
  return languageName(language, locale);
};

export function languageNames(
  result: MarketSuggestionsResult,
  locale: Locale = "en",
): string[] {
  const english = result.languages.filter((language) => language === ENGLISH);
  const others = result.languages.filter((language) => language !== ENGLISH);
  return [...english, ...others].map((language) =>
    languageNameOf(language, locale),
  );
}

export function marketCostSummary(
  store: Store,
  t: MessageTranslator = english,
): string {
  return store === "APP_STORE"
    ? t("markets.costAppStore", { limit: MARKET_SEED_LIMIT })
    : t("markets.costGooglePlay");
}

export function marketCostText(
  { dailyRequests }: MarketSuggestion,
  t: MessageTranslator = english,
): string {
  return t("markets.costText", {
    count: dailyRequests.listing,
    perKeyword: dailyRequests.perKeyword,
  });
}
