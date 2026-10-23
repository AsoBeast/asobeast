import {
  addUtcDays,
  CHECK_FRESH_DAYS,
  keywordLabel,
  type RankingSeriesItem,
} from "@asobeast/shared";
import type { ChartConfig } from "@/components/ui/chart";
import { seriesColor } from "@/components/charts/theme";

export const MAX_SERIES = 8;

export const NOT_FOUND_SUFFIX = "__notFound";

export function notFoundKey(keywordId: string): string {
  return `${keywordId}${NOT_FOUND_SUFFIX}`;
}

export const LONE_SUFFIX = "__lone";

export function loneKey(keywordId: string): string {
  return `${keywordId}${LONE_SUFFIX}`;
}

export const NOT_CHECKED = "Not checked";

type ChartRow = Record<string, string | number | null>;

type DayDepths = Record<string, number | null>;

export interface RankingChartData {
  rows: ChartRow[];
  depths: DayDepths[];
  config: ChartConfig;
  seriesLabels: Record<string, string>;
  keywordIds: string[];
  totalSeries: number;
  checkedDays: number;
}

export const hasCheck = (depths: DayDepths | undefined): boolean =>
  depths !== undefined && Object.values(depths).some((depth) => depth !== null);

export const lastCheckedIndex = (data: RankingChartData): number =>
  data.depths.findLastIndex(hasCheck);

function axisDays(checked: readonly string[], through: string): string[] {
  const first = checked[0];
  const last = checked.at(-1);
  if (first === undefined || last === undefined) return [];
  const settled = addUtcDays(through, -CHECK_FRESH_DAYS);
  const end = last > settled ? last : settled;
  const days: string[] = [];
  for (let day = first; day <= end; day = addUtcDays(day, 1)) {
    days.push(day);
  }
  return days;
}

const ranked = (row: ChartRow | undefined, keywordId: string) =>
  typeof row?.[keywordId] === "number";

function withLonePoints(
  rows: readonly ChartRow[],
  keywordIds: readonly string[],
): ChartRow[] {
  return rows.map((row, index) => {
    const marked: ChartRow = { ...row };
    for (const keywordId of keywordIds) {
      const lone =
        ranked(row, keywordId) &&
        !ranked(rows[index - 1], keywordId) &&
        !ranked(rows[index + 1], keywordId);
      marked[loneKey(keywordId)] = lone ? row[keywordId] : null;
    }
    return marked;
  });
}

export function buildRankingChart(
  series: RankingSeriesItem[],
  through: string,
): RankingChartData {
  const shown = series.slice(0, MAX_SERIES);
  const keywordIds = shown.map((item) => item.keywordId);

  const dates = new Set<string>();
  for (const item of shown) {
    for (const point of item.points) dates.add(point.date);
  }
  const days = axisDays([...dates].sort(), through);

  const config: ChartConfig = {};
  const seriesLabels: Record<string, string> = {};
  shown.forEach((item, index) => {
    const label = keywordLabel(item);
    config[item.keywordId] = { label, color: seriesColor(index) };
    seriesLabels[item.keywordId] = label;
  });

  const byDate = shown.map((item) => ({
    keywordId: item.keywordId,
    points: new Map(item.points.map((point) => [point.date, point])),
  }));
  const rows = days.map((date) => {
    const row: ChartRow = { date };
    for (const { keywordId, points } of byDate) {
      const point = points.get(date);
      row[keywordId] = point ? point.position : null;
      row[notFoundKey(keywordId)] =
        point && point.position === null ? point.depth : null;
    }
    return row;
  });
  const depths = days.map((date): DayDepths =>
    Object.fromEntries(
      byDate.map(({ keywordId, points }) => [
        keywordId,
        points.get(date)?.depth ?? null,
      ]),
    ),
  );

  return {
    rows: withLonePoints(rows, keywordIds),
    depths,
    config,
    seriesLabels,
    keywordIds,
    totalSeries: series.length,
    checkedDays: depths.filter(hasCheck).length,
  };
}
