import type { ChartCaptureSummary, ChartCompareWindow } from "@asobeast/shared";
import type { Moved } from "@/components/movement/movement-text";
import { formatDayMonth } from "@/lib/format";

const WINDOW_WORDS: Record<ChartCompareWindow, string> = {
  "1d": "previous day",
  "7d": "7 days ago",
  "30d": "30 days ago",
};

export function movementSortValue({ movement, delta }: Moved): number {
  if (movement === "new") return Number.NEGATIVE_INFINITY;
  if (movement === "none") return Number.POSITIVE_INFINITY;
  return delta ?? 0;
}

export function compareLabel(
  window: ChartCompareWindow,
  comparison: ChartCaptureSummary | null,
): string {
  return comparison
    ? `vs ${formatDayMonth(comparison.date)}`
    : `vs ${WINDOW_WORDS[window]}, none captured`;
}
