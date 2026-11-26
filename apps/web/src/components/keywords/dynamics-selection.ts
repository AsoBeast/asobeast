import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { MAX_SERIES } from "@/components/charts/pivot";
import { selectionForMarket } from "@/components/rankings/selection";
import type { KeywordChartSelection } from "@/lib/search-params";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export interface ChartedSelection {
  effective: string[];
  charted: string[];
}

export function chartedSelection(
  selected: readonly string[],
  tracked: TrackedKeywordItem[],
): ChartedSelection {
  const effective = selectionForMarket(tracked, selected);
  return { effective, charted: effective.slice(0, MAX_SERIES) };
}

export function resolveChartSelection(
  selection: KeywordChartSelection,
  tracked: readonly TrackedKeywordItem[],
): ChartedSelection {
  if (selection.mode === "hidden") {
    return { effective: [], charted: [] };
  }
  return chartedSelection(selection.ids, [...tracked]);
}

export const isCapped = (selection: ChartedSelection): boolean =>
  selection.effective.length > selection.charted.length;

export function cappingLine(
  selection: ChartedSelection,
  t: MessageTranslator = english,
): string {
  return t("bulk.chartCapped", {
    shown: selection.charted.length,
    total: selection.effective.length,
  });
}

export function withoutKeyword(
  selected: readonly string[],
  keywordId: string,
): string[] {
  return selected.filter((id) => id !== keywordId);
}

export const overChartLimit = (count: number): boolean => count > MAX_SERIES;

export const chartLimitLine = (t: MessageTranslator = english): string =>
  t("bulk.chartLimit", { limit: MAX_SERIES });
