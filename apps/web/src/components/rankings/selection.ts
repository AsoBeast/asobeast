import { keywordLabel, type TrackedKeywordItem } from "@asobeast/shared";

export const DEFAULT_SELECTION = 5;

export function topByOpportunity(
  tracked: TrackedKeywordItem[],
  count: number,
): string[] {
  return [...tracked]
    .sort((a, b) => (b.opportunity ?? -1) - (a.opportunity ?? -1))
    .slice(0, count)
    .map((item) => item.keywordId);
}

export function pickerLabel(
  tracked: readonly TrackedKeywordItem[],
): (item: TrackedKeywordItem) => string {
  const multiMarket = new Set(tracked.map((item) => item.country)).size > 1;
  return (item) => (multiMarket ? keywordLabel(item) : item.text);
}
