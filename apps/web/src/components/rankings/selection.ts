import type { TrackedKeywordItem } from "@asobeast/shared";

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
