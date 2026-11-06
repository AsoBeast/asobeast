import type { KeywordDiscoveryItem } from "@asobeast/shared";

const idsOf = (items: readonly KeywordDiscoveryItem[]): string[] =>
  items.map(({ keywordId }) => keywordId);

export const recommendedIds = (
  items: readonly KeywordDiscoveryItem[],
): string[] => idsOf(items.filter(({ recommended }) => recommended));

export const rankedIds = (items: readonly KeywordDiscoveryItem[]): string[] =>
  idsOf(items.filter(({ state }) => state === "ranked"));

export interface BulkCounts {
  selected: number;
  recommended: number;
  ranked: number;
}

export const bulkLabels = ({ selected, recommended, ranked }: BulkCounts) => ({
  selected: `Track selected (${selected})`,
  recommended: `Track recommended (${recommended})`,
  ranked: `Track all ranked (${ranked})`,
});

export const selectedIn = (
  items: readonly KeywordDiscoveryItem[],
  selection: Readonly<Record<string, boolean>>,
): string[] => idsOf(items.filter(({ keywordId }) => selection[keywordId]));
