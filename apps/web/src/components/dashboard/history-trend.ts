import type {
  PortfolioHistory,
  PortfolioHistoryPoint,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import type { DailyPair } from "@/components/charts/diverging-trend";
import {
  dayTicks,
  valueAxis,
  windowDays,
} from "@/components/charts/trend-axis";
import { dayBefore } from "@/lib/utc-day";

export type TrendMetric = "visibility" | "top10";

export interface TrendRow {
  date: string;
  value: number | null;
  pending: number | null;
  previous: number | null;
}

export interface HistoryTrend {
  rows: TrendRow[];
  days: number;
  checked: number;
  compared: boolean;
  pendingDay: string | null;
  domain: [number, number];
  valueTicks: number[];
  dayTicks: string[];
}

export const unfinishedSince = (run: WorkspaceRunStatus): string | null =>
  (run.state === "running" || run.state === "delayed") && run.startedAt
    ? run.startedAt.slice(0, 10)
    : null;

const EMPTY: HistoryTrend = {
  rows: [],
  days: 0,
  checked: 0,
  compared: false,
  pendingDay: null,
  domain: [0, 1],
  valueTicks: [0, 1],
  dayTicks: [],
};

const valuesBy = (
  points: PortfolioHistoryPoint[],
  metric: TrendMetric,
): Map<string, number> =>
  new Map(points.map((point) => [point.date, point[metric]]));

export function historyTrend(
  history: PortfolioHistory,
  metric: TrendMetric,
  unfinished: string | null,
): HistoryTrend {
  const { points, previous, days } = history;
  const newest = points.at(-1);
  if (newest === undefined) return { ...EMPTY, days };

  const recorded = valuesBy(points, metric);
  const earlier = valuesBy(previous, metric);
  const finished = points.at(-2);
  const pending =
    unfinished !== null && finished !== undefined && newest.date >= unfinished;
  const dashed = new Set(pending ? [finished.date, newest.date] : []);

  const dates = windowDays(newest.date, days);
  const rows = dates.map((date): TrendRow => {
    const value = recorded.get(date) ?? null;
    return {
      date,
      value: pending && date === newest.date ? null : value,
      pending: dashed.has(date) ? value : null,
      previous: earlier.get(dayBefore(date, days)) ?? null,
    };
  });

  return {
    rows,
    days,
    checked: points.length,
    compared: rows.some((row) => row.previous !== null),
    pendingDay: pending ? newest.date : null,
    ...valueAxis(
      rows.flatMap((row) =>
        [row.value, row.pending, row.previous].filter(
          (value) => value !== null,
        ),
      ),
    ),
    dayTicks: dayTicks(dates),
  };
}

export const movementPairs = (history: PortfolioHistory): DailyPair[] =>
  history.points.map((point) => ({
    date: point.date,
    up: point.climbed,
    down: point.fell,
  }));
