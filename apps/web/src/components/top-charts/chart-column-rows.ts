import type {
  ChartCaptureSummary,
  ChartEntryItem,
  ChartPage,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enTopCharts from "../../../messages/en/topCharts.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDateTimeInLocale, formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "topCharts",
  messages: { topCharts: enTopCharts },
});

export const CHART_COLUMN_ROWS = 25;

export function columnRows(page: Pick<ChartPage, "entries">): ChartEntryItem[] {
  return [...page.entries]
    .sort((a, b) => a.position - b.position)
    .slice(0, CHART_COLUMN_ROWS);
}

export function columnCount(
  page: Pick<ChartPage, "capture" | "dates" | "entries" | "today">,
  date: string | null,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  if (page.dates.length === 0) return t("column.notCaptured");
  if (!page.capture) {
    return t("column.notCapturedOn", {
      date: formatDayMonthInLocale(date ?? page.today, locale),
    });
  }
  const total = page.entries.length;
  if (total === 0) {
    return t("column.noApps", {
      date: formatDayMonthInLocale(page.capture.date, locale),
    });
  }
  return total > CHART_COLUMN_ROWS
    ? t("column.top", { shown: CHART_COLUMN_ROWS, total })
    : t("appCount", { count: total });
}

export function capturedLine(
  capture: ChartCaptureSummary,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return t("column.captured", {
    date: formatDateTimeInLocale(capture.capturedAt, locale),
  });
}

export function listsNoApps<P extends Pick<ChartPage, "capture" | "entries">>(
  page: P,
): page is P & { capture: ChartCaptureSummary } {
  return page.capture !== null && page.entries.length === 0;
}

export function capturableToday(
  page: Pick<ChartPage, "dates" | "today">,
): boolean {
  return page.dates[0] !== page.today;
}

export function categoryDates(
  pages: readonly Pick<ChartPage, "dates">[],
): string[] {
  return [...new Set(pages.flatMap((page) => page.dates))].sort().reverse();
}
