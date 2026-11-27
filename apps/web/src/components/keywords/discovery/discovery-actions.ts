import type { KeywordDiscoveryItem } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

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

export const bulkLabels = (
  { selected, recommended, ranked }: BulkCounts,
  t: MessageTranslator,
) => ({
  selected: t("discovery.bulk.selected", { count: selected }),
  recommended: t("discovery.bulk.recommended", { count: recommended }),
  ranked: t("discovery.bulk.ranked", { count: ranked }),
});

export const selectedIn = (
  items: readonly KeywordDiscoveryItem[],
  selection: Readonly<Record<string, boolean>>,
): string[] => idsOf(items.filter(({ keywordId }) => selection[keywordId]));
