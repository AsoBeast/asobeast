"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ActionActivity } from "@asobeast/shared";
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
import { ACTIVITY_SERIES, activeDays, activityRows } from "./activity-chart";

const chartConfig = Object.fromEntries(
  ACTIVITY_SERIES.map((series, index) => [
    series.key,
    { label: series.label, color: seriesColor(index) },
  ]),
) satisfies ChartConfig;

const LABELS = Object.fromEntries(
  ACTIVITY_SERIES.map((series) => [series.key, series.label]),
);

const ORDER = ACTIVITY_SERIES.map((series) => series.key);

export function ActionActivityChart({
  activity,
}: {
  activity: ActionActivity;
}) {
  if (activeDays(activity) < MIN_TREND_POINTS) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title="Not enough activity yet"
        body="The chart fills in as actions open and close."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label="Actions opened and closed per day"
    >
      <BarChart
        accessibilityLayer
        data={activityRows(activity)}
        margin={CHART_MARGIN}
      >
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <ChartLegend content={<SeriesLegend labels={LABELS} order={ORDER} />} />
        {ACTIVITY_SERIES.map((series, index) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            stackId="activity"
            fill={`var(--color-${series.key})`}
            stroke={`var(--color-${series.key})`}
            strokeDasharray={seriesDash(index)}
            radius={index === ACTIVITY_SERIES.length - 1 ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
