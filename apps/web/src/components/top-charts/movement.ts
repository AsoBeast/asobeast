import type {
  ChartCaptureSummary,
  ChartCompareWindow,
  ChartEntryItem,
} from "@asobeast/shared";
import { formatDayMonth } from "@/lib/format";

type Moved = Pick<ChartEntryItem, "movement" | "delta" | "previous">;

const WINDOW_WORDS: Record<ChartCompareWindow, string> = {
  "1d": "previous day",
  "7d": "7 days ago",
  "30d": "30 days ago",
};

export function movementText({ movement, delta, previous }: Moved): string {
  if (movement === "up") return `Up ${Math.abs(delta ?? 0)} from #${previous}`;
  if (movement === "down") return `Down ${delta} from #${previous}`;
  if (movement === "same") return "No change";
  if (movement === "new") return "New entry";
  return "No earlier capture";
}

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
