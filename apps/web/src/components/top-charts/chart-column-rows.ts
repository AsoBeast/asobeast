import type { ChartEntryItem, ChartPage } from "@asobeast/shared";
import { formatDayMonth } from "@/lib/format";

export const CHART_COLUMN_ROWS = 25;

export function columnRows(page: Pick<ChartPage, "entries">): ChartEntryItem[] {
  return [...page.entries]
    .sort((a, b) => a.position - b.position)
    .slice(0, CHART_COLUMN_ROWS);
}

export function columnCaption(
  page: Pick<ChartPage, "capture" | "dates" | "entries" | "today">,
  date: string | null,
): string {
  if (page.dates.length === 0) return "Not captured yet";
  if (!page.capture) {
    return `Not captured on ${formatDayMonth(date ?? page.today)}`;
  }
  const total = page.entries.length;
  const count =
    total > CHART_COLUMN_ROWS
      ? `Top ${CHART_COLUMN_ROWS} of ${total}`
      : `${total} ${total === 1 ? "app" : "apps"}`;
  return `${count} · ${formatDayMonth(page.capture.date)}`;
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
