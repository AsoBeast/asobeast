import type { AuditBenchmarkMetric, AuditBenchmarkRow } from "@asobeast/shared";
import { formatMeasure, formatRating } from "@/lib/format";

export type Comparison = "ahead" | "behind" | "even" | "unknown";

export const COMPARISON_LABEL: Record<Comparison, string> = {
  ahead: "Ahead",
  behind: "Behind",
  even: "Even",
  unknown: "No data",
};

export function comparison(row: AuditBenchmarkRow): Comparison {
  if (row.you === null || row.median === null) return "unknown";
  if (row.you === row.median) return "even";
  const higherIsBetter = row.better === "higher";
  const youLead = row.you > row.median;
  return youLead === higherIsBetter ? "ahead" : "behind";
}

export function formatBenchmarkValue(
  metric: AuditBenchmarkMetric,
  value: number | null,
): string {
  if (value === null) return "—";
  return metric === "rating-average"
    ? formatRating(value)
    : formatMeasure(value);
}

const RATING_GAP_DIGITS = 2;

export function medianGap(row: AuditBenchmarkRow): string | null {
  if (row.you === null || row.median === null) return null;
  const rating = row.metric === "rating-average";
  const gap = rating
    ? Number((row.you - row.median).toFixed(RATING_GAP_DIGITS))
    : row.you - row.median;
  const size = rating
    ? Math.abs(gap).toFixed(RATING_GAP_DIGITS)
    : formatMeasure(Math.abs(gap));
  if (!/[1-9]/.test(size)) return "0";
  return `${gap > 0 ? "+" : "-"}${size}`;
}
