import {
  formatRankPosition,
  RANK_DEPTH,
  SERP_DEPTH,
  type ActionItem,
  type ActionTrend,
  type ActionTrendMetric,
} from "@asobeast/shared";
import { formatMeasure } from "@/lib/format";

export interface TrendMarker {
  date: string;
  label: "Opened" | "Done";
}

export interface TrendChartRow {
  date: string;
  value: number | null;
  notFound: number | null;
}

export interface TrendChartData {
  rows: TrendChartRow[];
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

function domainFor(
  trend: ActionTrend,
  rows: readonly TrendChartRow[],
): TrendChartData["domain"] {
  switch (trend.metric) {
    case "position":
      return [
        1,
        Math.max(
          SERP_DEPTH,
          ...rows.map((row) => row.notFound ?? row.value ?? 0),
        ),
      ];
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
  dates: readonly string[],
  firstDay: string | undefined,
): TrendMarker[] {
  const candidates: TrendMarker[] = [
    { date: item.firstSeenAt.slice(0, 10), label: "Opened" },
    ...(item.closedAt && item.status === "DONE"
      ? [{ date: item.closedAt.slice(0, 10), label: "Done" as const }]
      : []),
  ];
  return candidates.flatMap((marker) => {
    if (firstDay === undefined || marker.date < firstDay) return [];
    const next = dates.find((date) => date >= marker.date);
    return next === undefined ? [] : [{ ...marker, date: next }];
  });
}

export function trendChartData(
  trend: ActionTrend,
  item: ActionItem,
): TrendChartData {
  const rows = trend.points
    .filter((point) => point.checked)
    .map((point) => ({
      date: point.date,
      value: point.value,
      notFound:
        trend.metric === "position" && point.value === null
          ? (trend.depth ?? RANK_DEPTH)
          : null,
    }));
  return {
    rows,
    metricLabel: TREND_METRIC_LABEL[trend.metric],
    reversed: trend.metric === "position",
    domain: domainFor(trend, rows),
    markers: markersFor(
      item,
      rows.map((row) => row.date),
      trend.points[0]?.date,
    ),
    summary: summaryOf(trend, trend.points.length),
    plotted: rows.filter((row) => row.value !== null || row.notFound !== null)
      .length,
  };
}
