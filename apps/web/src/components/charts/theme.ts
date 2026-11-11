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
  compact: "h-[200px]",
  tall: "h-[200px] md:h-[268px]",
  hero: "h-[300px] md:h-[360px]",
} as const;

export const CHART_MARGIN = { left: 4, right: 8, top: 8 } as const;

export const GRID_PROPS = {
  vertical: false,
  stroke: "var(--border-subtle)",
} as const;

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

export const RANK_AXIS_PROPS = {
  ...VALUE_AXIS_PROPS,
  reversed: true,
  scale: "sqrt",
  interval: 0,
  allowDataOverflow: true,
  width: 36,
} as const;

export const LINE_PROPS = {
  type: "monotone",
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 3.5, strokeWidth: 2, stroke: "var(--card)" },
  isAnimationActive: false,
} as const;

export const COUNT_LINE_PROPS = {
  ...LINE_PROPS,
  type: "stepAfter",
} as const;

export const PREVIOUS_LINE_PROPS = {
  type: "monotone",
  stroke: "var(--chart-previous)",
  strokeWidth: 1.5,
  dot: false,
  activeDot: false,
  isAnimationActive: false,
} as const;

export const PENDING_LINE_PROPS = {
  strokeDasharray: "4 4",
  dot: false,
  activeDot: false,
  isAnimationActive: false,
} as const;

export const PENDING_DOT_PROPS = {
  r: 3.5,
  fill: "var(--card)",
  strokeWidth: 2,
} as const;

export const MOVEMENT_COLORS = {
  climbed: "var(--signal-up)",
  fell: "var(--signal-down)",
} as const;

export const ACTION_COLORS = {
  opened: "var(--chart-1)",
  closed: "var(--chart-previous)",
} as const;

export const BAR_PROPS = {
  radius: 2,
  maxBarSize: 14,
  fillOpacity: 0.85,
  isAnimationActive: false,
} as const;

export const ZERO_LINE_PROPS = {
  stroke: "var(--border)",
} as const;

export const CHANGE_MARKER_PROPS = {
  stroke: "var(--faint-foreground)",
  strokeDasharray: "3 3",
} as const;

export const FADE_STOPS = [
  { offset: "0%", opacity: 0.16 },
  { offset: "100%", opacity: 0 },
] as const;

export const TIME_TOOLTIP_PROPS = {
  labelFormatter: (value: unknown) => formatDayMonth(String(value)),
} as const;

export const SCORE_AXIS_TICKS = [0, 25, 50, 75, 100];

export const SCORE_AXIS_PROPS = {
  type: "number",
  domain: [0, 100],
  ticks: SCORE_AXIS_TICKS,
  allowDecimals: false,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

export const THRESHOLD_LINE_PROPS = {
  stroke: "var(--faint-foreground)",
  strokeDasharray: "3 3",
} as const;
