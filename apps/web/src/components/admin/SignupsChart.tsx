"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { AdminSignupDay } from "@asobeast/shared";
import { ChartNotice, MIN_TREND_POINTS } from "@/components/charts/ChartStates";
import { SeriesLegend } from "@/components/charts/SeriesLegend";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  seriesColor,
  seriesDash,
  TIME_AXIS_PROPS,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const SIGNUP_SERIES = [
  { key: "users", label: "Accounts" },
  { key: "workspaces", label: "Workspaces" },
] as const;

const chartConfig = Object.fromEntries(
  SIGNUP_SERIES.map((series, index) => [
    series.key,
    { label: series.label, color: seriesColor(index) },
  ]),
) satisfies ChartConfig;

const LABELS = Object.fromEntries(
  SIGNUP_SERIES.map((series) => [series.key, series.label]),
);

const ORDER = SIGNUP_SERIES.map((series) => series.key);

const activeDays = (days: AdminSignupDay[]) =>
  days.filter((day) => day.users + day.workspaces > 0).length;

export function SignupsChart({ signups }: { signups: AdminSignupDay[] }) {
  if (activeDays(signups) < MIN_TREND_POINTS) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title="Too few sign ups in the last 30 days to chart."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label="Accounts and workspaces created per day"
    >
      <BarChart accessibilityLayer data={signups} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <ChartLegend content={<SeriesLegend labels={LABELS} order={ORDER} />} />
        {SIGNUP_SERIES.map((series, index) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            fill={`var(--color-${series.key})`}
            stroke={`var(--color-${series.key})`}
            strokeDasharray={seriesDash(index)}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
