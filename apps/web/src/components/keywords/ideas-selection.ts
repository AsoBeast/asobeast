import type { KeywordSuggestion, SpiderSuggestion } from "@asobeast/shared";

export const IDEAS_TOP_COUNT = 5;

export function ideaSuggestions(
  suggestions: readonly SpiderSuggestion[],
): KeywordSuggestion[] {
  return suggestions.map((suggestion) => ({
    text: suggestion.text,
    strategy: "search",
    ...(suggestion.priority === null ? {} : { priority: suggestion.priority }),
  }));
}

export function topIdeas(
  suggestions: readonly KeywordSuggestion[],
  tracked: ReadonlySet<string>,
  count: number = IDEAS_TOP_COUNT,
): string[] {
  return suggestions
    .map((suggestion) => suggestion.text)
    .filter((text) => !tracked.has(text))
    .slice(0, count);
}

export function addTopLabel(count: number): string {
  return `Add top ${count}`;
}
