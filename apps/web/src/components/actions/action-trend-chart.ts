import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import {
  formatRankPosition,
  RANK_DEPTH,
  SERP_DEPTH,
  type ActionItem,
  type ActionTrend,
  type ActionTrendMetric,
} from "@asobeast/shared";
import { formatMeasureFixed, formatNumber, MEASURE_DIGITS } from "@/lib/format";

export interface TrendMarker {
  date: string;
  label: string;
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
  conversion: "Conversion",
};

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

export const trendMetricLabel = (
  metric: ActionTrendMetric,
  t: MessageTranslator = english,
): string => t(`trend.metrics.${metric}`);

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
    case "conversion":
      return ["auto", "auto"];
  }
}

export const METRIC_DIGITS: Record<ActionTrendMetric, number> = {
  position: 0,
  visibility: MEASURE_DIGITS,
  audit: 0,
  rating: MEASURE_DIGITS,
  updateAge: 0,
  conversion: MEASURE_DIGITS,
};

export function metricValue(metric: ActionTrendMetric, value: number): string {
  const shown =
    METRIC_DIGITS[metric] === 0
      ? formatNumber(Math.round(value))
      : formatMeasureFixed(value);
  return metric === "conversion" ? `${shown}%` : shown;
}

export function trendValue(trend: ActionTrend, value: number | null): string {
  if (trend.metric === "position") {
    return value === null
      ? formatRankPosition(value, trend.depth ?? RANK_DEPTH)
      : `#${value}`;
  }
  return value === null ? "—" : metricValue(trend.metric, value);
}

function summaryOf(
  trend: ActionTrend,
  days: number,
  t: MessageTranslator,
): string {
  const checked = trend.points.filter((point) => point.checked);
  const label = trendMetricLabel(trend.metric, t);
  if (checked.length === 0) return t("trend.noMeasurements", { metric: label });
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
  return t("trend.summary", {
    metric: label,
    before: trendValue(trend, first.value),
    after: trendValue(trend, last.value),
    days,
    best: trendValue(trend, best.value),
    worst: trendValue(trend, worst.value),
  });
}

function markersFor(
  item: ActionItem,
  dates: readonly string[],
  firstDay: string | undefined,
  t: MessageTranslator,
): TrendMarker[] {
  const candidates: TrendMarker[] = [
    { date: item.firstSeenAt.slice(0, 10), label: t("trend.markers.opened") },
    ...(item.closedAt && item.status === "DONE"
      ? [{ date: item.closedAt.slice(0, 10), label: t("trend.markers.done") }]
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
  t: MessageTranslator = english,
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
    metricLabel: trendMetricLabel(trend.metric, t),
    reversed: trend.metric === "position",
    domain: domainFor(trend, rows),
    markers: markersFor(
      item,
      rows.map((row) => row.date),
      trend.points[0]?.date,
      t,
    ),
    summary: summaryOf(trend, trend.points.length, t),
    plotted: rows.filter((row) => row.value !== null || row.notFound !== null)
      .length,
  };
}
