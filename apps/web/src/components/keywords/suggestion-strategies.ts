import type { KeywordSuggestionStrategy } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const STRATEGIES: {
  value: KeywordSuggestionStrategy;
  label: string;
  description: string;
}[] = [
  {
    value: "metadata",
    label: enKeywords.suggestions.metadata,
    description: enKeywords.suggestions.metadataDescription,
  },
  {
    value: "search",
    label: enKeywords.suggestions.search,
    description: enKeywords.suggestions.searchDescription,
  },
  {
    value: "similar",
    label: enKeywords.suggestions.similar,
    description: enKeywords.suggestions.similarDescription,
  },
  {
    value: "developer",
    label: enKeywords.suggestions.developer,
    description: enKeywords.suggestions.developerDescription,
  },
  {
    value: "competitors",
    label: enKeywords.suggestions.competitors,
    description: enKeywords.suggestions.competitorsDescription,
  },
  {
    value: "competitorSearch",
    label: enKeywords.suggestions.competitorSearch,
    description: enKeywords.suggestions.competitorSearchDescription,
  },
  {
    value: "reviews",
    label: enKeywords.suggestions.reviews,
    description: enKeywords.suggestions.reviewsDescription,
  },
];

export function strategyLabel(
  strategy: KeywordSuggestionStrategy,
  t: MessageTranslator = english,
): string {
  return t(`suggestions.${strategy}`);
}

export function strategyDescription(
  strategy: KeywordSuggestionStrategy,
  t: MessageTranslator = english,
): string {
  return t(`suggestions.${strategy}Description`);
}

export function strategyOptions(t: MessageTranslator = english) {
  return STRATEGIES.map(({ value }) => ({
    value,
    label: strategyLabel(value, t),
    description: strategyDescription(value, t),
  }));
}

const NOUN_KEYS: Partial<Record<KeywordSuggestionStrategy, string>> = {
  competitors: "competitorNoun",
  competitorSearch: "competitorNoun",
  reviews: "reviewNoun",
};

export function suggestionNoun(
  strategy: KeywordSuggestionStrategy,
  t: MessageTranslator = english,
): string {
  const key = NOUN_KEYS[strategy] ?? "appNoun";
  return t(`suggestions.${key}`);
}

export const USED_BY_NOUN: Partial<Record<KeywordSuggestionStrategy, string>> =
  {
    competitors: "competitor",
    competitorSearch: "competitor",
    reviews: "review",
  };

export const EMPTY_COPY: Partial<Record<KeywordSuggestionStrategy, string>> = {
  competitorSearch: enKeywords.suggestions.emptyCompetitorSearch,
  developer: enKeywords.suggestions.emptyDeveloper,
};

export function suggestionEmpty(
  strategy: KeywordSuggestionStrategy,
  t: MessageTranslator = english,
): string {
  if (strategy === "competitorSearch") {
    return t("suggestions.emptyCompetitorSearch");
  }
  if (strategy === "developer") return t("suggestions.emptyDeveloper");
  return t("suggestions.empty");
}
