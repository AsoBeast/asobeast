import { formatDayMonth } from "@/lib/format";

export const CHART_SERIES_COUNT = 8;

export function seriesColor(index: number): string {
  return `var(--chart-${(index % CHART_SERIES_COUNT) + 1})`;
}

const SERIES_DASH = [
  undefined,
  "6 3",
  "2 3",
  "10 4 2 4",
  "1 3",
  "12 4",
  "4 2 1 2",
  "8 3 2 3",
] as const;

export function seriesDash(index: number): string | undefined {
  return SERIES_DASH[index % SERIES_DASH.length];
}

export const CHART_HEIGHT = {
  compact: "h-[240px]",
  tall: "h-[300px]",
  hero: "h-[360px]",
} as const;

export const CHART_MARGIN = { left: 4, right: 8, top: 8 } as const;

export const GRID_PROPS = { vertical: false } as const;

export const TIME_AXIS_PROPS = {
  dataKey: "date",
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 24,
  tickFormatter: (value: unknown) => formatDayMonth(String(value)),
} as const;

export const VALUE_AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  width: 32,
} as const;

export const LINE_PROPS = {
  type: "monotone",
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 4 },
} as const;

export const TIME_TOOLTIP_PROPS = {
  labelFormatter: (value: unknown) => formatDayMonth(String(value)),
} as const;
