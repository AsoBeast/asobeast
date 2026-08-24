import { keywordLabel, type RankingSeriesItem } from "@asobeast/shared";
import type { ChartConfig } from "@/components/ui/chart";
import { seriesColor } from "@/components/charts/theme";

export const MAX_SERIES = 8;

export const NOT_FOUND_SUFFIX = "__notFound";

export function notFoundKey(keywordId: string): string {
  return `${keywordId}${NOT_FOUND_SUFFIX}`;
}

export interface RankingChartData {
  rows: Array<Record<string, string | number | null>>;
  depths: Array<Record<string, number | null>>;
  config: ChartConfig;
  seriesLabels: Record<string, string>;
  keywordIds: string[];
  totalSeries: number;
}

export function buildRankingChart(
  series: RankingSeriesItem[],
): RankingChartData {
  const shown = series.slice(0, MAX_SERIES);

  const dates = new Set<string>();
  for (const item of shown) {
    for (const point of item.points) dates.add(point.date);
  }
  const sortedDates = [...dates].sort();

  const config: ChartConfig = {};
  const seriesLabels: Record<string, string> = {};
  shown.forEach((item, index) => {
    const label = keywordLabel(item);
    config[item.keywordId] = { label, color: seriesColor(index) };
    seriesLabels[item.keywordId] = label;
  });

  const rows = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const item of shown) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[item.keywordId] = point ? point.position : null;
      row[notFoundKey(item.keywordId)] =
        point && point.position === null ? point.depth : null;
    }
    return row;
  });
  const depths = sortedDates.map((date) => {
    const row: Record<string, number | null> = {};
    for (const item of shown) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[item.keywordId] = point ? point.depth : null;
    }
    return row;
  });

  return {
    rows,
    depths,
    config,
    seriesLabels,
    keywordIds: shown.map((item) => item.keywordId),
    totalSeries: series.length,
  };
}
