import type {
  PortfolioHistory,
  PortfolioHistoryPoint,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";

const WEEK_DAYS = 7;
const MAX_DAY_TICKS = 6;
const MAX_VALUE_TICKS = 5;
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

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

export function valueAxis(
  values: number[],
): Pick<HistoryTrend, "domain" | "valueTicks"> {
  const least = values.length === 0 ? 0 : Math.min(...values);
  const most = values.length === 0 ? 0 : Math.max(...values);
  const step =
    STEPS.find((candidate) => {
      const low = Math.floor(least / candidate) * candidate;
      const high = Math.max(Math.ceil(most / candidate) * candidate, low + 1);
      return (high - low) / candidate <= MAX_VALUE_TICKS - 1;
    }) ?? STEPS[STEPS.length - 1];
  const low = Math.max(0, Math.floor(least / step) * step);
  const ceiling = Math.ceil(most / step) * step;
  const high = ceiling > low ? ceiling : low + step;
  const valueTicks: number[] = [];
  for (let tick = low; tick <= high; tick += step) valueTicks.push(tick);
  return { domain: [low, high], valueTicks };
}

export function windowDays(newest: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    dayBefore(newest, days - 1 - index),
  );
}

export function dayTicks(dates: string[]): string[] {
  const weeks = Math.ceil(dates.length / WEEK_DAYS / MAX_DAY_TICKS);
  const every = dates.length <= WEEK_DAYS ? 1 : weeks * WEEK_DAYS;
  return dates.filter((_, index) => (dates.length - 1 - index) % every === 0);
}

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

export interface DivergingRow {
  date: string;
  up: number;
  down: number;
  checked: boolean;
}

export interface DivergingTrend {
  rows: DivergingRow[];
  days: number;
  checked: number;
  domain: [number, number];
  valueTicks: number[];
  dayTicks: string[];
}

export interface DailyPair {
  date: string;
  up: number;
  down: number;
}

export function divergingTrend(
  pairs: DailyPair[],
  days: number,
  active = pairs.length,
): DivergingTrend {
  const newest = pairs.at(-1);
  if (newest === undefined) {
    return {
      rows: [],
      days,
      checked: 0,
      domain: [-1, 1],
      valueTicks: [-1, 0, 1],
      dayTicks: [],
    };
  }
  const byDate = new Map(pairs.map((pair) => [pair.date, pair]));
  const dates = windowDays(newest.date, days);
  const rows = dates.map((date): DivergingRow => {
    const pair = byDate.get(date);
    return {
      date,
      up: pair?.up ?? 0,
      down: pair && pair.down > 0 ? -pair.down : 0,
      checked: pair !== undefined,
    };
  });
  const reach = Math.max(1, ...rows.map((row) => Math.max(row.up, -row.down)));
  const { domain, valueTicks } = valueAxis([0, reach]);
  const top = domain[1];
  return {
    rows,
    days,
    checked: active,
    domain: [-top, top],
    valueTicks: [
      ...valueTicks
        .filter((tick) => tick > 0)
        .map((tick) => -tick)
        .reverse(),
      ...valueTicks,
    ],
    dayTicks: dayTicks(dates),
  };
}

export const movementPairs = (history: PortfolioHistory): DailyPair[] =>
  history.points.map((point) => ({
    date: point.date,
    up: point.climbed,
    down: point.fell,
  }));
