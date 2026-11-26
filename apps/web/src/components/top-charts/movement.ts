import type { ChartCaptureSummary, ChartCompareWindow } from "@asobeast/shared";
import type { Moved } from "@/components/movement/movement-text";
import { createTranslator } from "next-intl";
import enTopCharts from "../../../messages/en/topCharts.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "topCharts",
  messages: { topCharts: enTopCharts },
});

export function movementSortValue({ movement, delta }: Moved): number {
  if (movement === "new") return Number.NEGATIVE_INFINITY;
  if (movement === "none") return Number.POSITIVE_INFINITY;
  return delta ?? 0;
}

export function compareLabel(
  window: ChartCompareWindow,
  comparison: ChartCaptureSummary | null,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return comparison
    ? t("compareWords.vsDate", {
        date: formatDayMonthInLocale(comparison.date, locale),
      })
    : `${t("compareWords.vs")}${t(`compareWords.${window}`)}, ${t("compareWords.noneCaptured")}`;
}
