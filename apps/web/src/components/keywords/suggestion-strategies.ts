import {
  isStoreSuggestionStrategy,
  type KeywordSuggestionStrategy,
} from "@asobeast/shared";

export const STRATEGIES: {
  value: KeywordSuggestionStrategy;
  label: string;
  description: string;
}[] = [
  {
    value: "metadata",
    label: "Metadata",
    description: "Phrases from your app's own metadata",
  },
  {
    value: "search",
    label: "Search",
    description: "App Store autocomplete terms",
  },
  {
    value: "similar",
    label: "Similar apps",
    description: "Terms from apps like yours",
  },
  {
    value: "developer",
    label: "More by developer",
    description: "Terms from the rest of your developer's catalogue",
  },
  {
    value: "competitors",
    label: "Competitors",
    description: "Terms your competitors rank for",
  },
  {
    value: "competitorSearch",
    label: "Competitor searches",
    description: "What people search around your competitors' phrases",
  },
  {
    value: "reviews",
    label: "Reviews",
    description: "Phrases from your users' reviews",
  },
];

export const USED_BY_NOUN: Partial<Record<KeywordSuggestionStrategy, string>> =
  {
    competitors: "competitor",
    competitorSearch: "competitor",
    reviews: "review",
  };

export const EMPTY_COPY: Partial<Record<KeywordSuggestionStrategy, string>> = {
  competitorSearch:
    "Your competitors' titles share no phrase to search from in this market yet.",
  developer:
    "No other apps found for this developer, or the latest snapshot carries no developer id.",
};

export const storeLookupLabels = (): string[] =>
  STRATEGIES.filter((entry) => isStoreSuggestionStrategy(entry.value)).map(
    (entry) => entry.label,
  );
