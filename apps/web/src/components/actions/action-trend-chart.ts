import {
  formatRankPosition,
  RANK_DEPTH,
  type ActionItem,
  type ActionTrend,
  type ActionTrendMetric,
} from "@asobeast/shared";
import { formatMeasure } from "@/lib/format";

export interface TrendMarker {
  date: string;
  label: "Opened" | "Done";
}

export interface TrendChartData {
  rows: Array<{ date: string; value: number | null }>;
  metricLabel: string;
  reversed: boolean;
  domain: [number, number] | ["auto", "auto"];
  markers: TrendMarker[];
  summary: string;
  plotted: number;
}

export const TREND_METRIC_LABEL: Record<ActionTrendMetric, string> = {
  position: "Position",
  visibility: "Visibility",
  audit: "Audit score",
  rating: "Average review score",
  updateAge: "Days since update",
};

function domainFor(trend: ActionTrend): TrendChartData["domain"] {
  switch (trend.metric) {
    case "position":
      return [1, trend.depth ?? RANK_DEPTH];
    case "visibility":
    case "audit":
      return [0, 100];
    case "rating":
      return [1, 5];
    case "updateAge":
      return ["auto", "auto"];
  }
}

export function trendValue(trend: ActionTrend, value: number | null): string {
  if (trend.metric === "position") {
    return value === null
      ? formatRankPosition(value, trend.depth ?? RANK_DEPTH)
      : `#${value}`;
  }
  return value === null ? "—" : formatMeasure(value);
}

function summaryOf(trend: ActionTrend, days: number): string {
  const checked = trend.points.filter((point) => point.checked);
  const label = TREND_METRIC_LABEL[trend.metric];
  if (checked.length === 0) return `${label} has no measurements yet.`;
  const comparable = (value: number | null) =>
    value ?? (trend.depth ?? RANK_DEPTH) + 1;
  const ordered = [...checked].sort(
    (left, right) => comparable(left.value) - comparable(right.value),
  );
  const lowerIsBetter = trend.direction === "lower_is_better";
  const best = lowerIsBetter ? ordered[0] : ordered[ordered.length - 1];
  const worst = lowerIsBetter ? ordered[ordered.length - 1] : ordered[0];
  const first = checked[0];
  const last = checked[checked.length - 1];
  return `${label} went from ${trendValue(trend, first.value)} to ${trendValue(trend, last.value)} over ${days} days; best ${trendValue(trend, best.value)}, worst ${trendValue(trend, worst.value)}.`;
}

function markersFor(
  item: ActionItem,
  dates: ReadonlySet<string>,
): TrendMarker[] {
  const candidates: TrendMarker[] = [
    { date: item.firstSeenAt.slice(0, 10), label: "Opened" },
    ...(item.closedAt && item.status === "DONE"
      ? [{ date: item.closedAt.slice(0, 10), label: "Done" as const }]
      : []),
  ];
  return candidates.filter((marker) => dates.has(marker.date));
}

export function trendChartData(
  trend: ActionTrend,
  item: ActionItem,
): TrendChartData {
  const rows = trend.points.map((point) => ({
    date: point.date,
    value: point.value,
  }));
  return {
    rows,
    metricLabel: TREND_METRIC_LABEL[trend.metric],
    reversed: trend.metric === "position",
    domain: domainFor(trend),
    markers: markersFor(item, new Set(rows.map((row) => row.date))),
    summary: summaryOf(trend, rows.length),
    plotted: rows.filter((row) => row.value !== null).length,
  };
}
