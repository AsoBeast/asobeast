import { dayTicks, valueAxis, windowDays } from "./trend-axis";

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
