"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { AdminSignupDay } from "@asobeast/shared";
import { ChartNotice } from "@/components/charts/ChartStates";
import { MIN_TREND_POINTS } from "@/lib/trend-points";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  users: { label: "Accounts", color: seriesColor(0) },
} satisfies ChartConfig;

const activeDays = (days: AdminSignupDay[]) =>
  days.filter((day) => day.users > 0).length;

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
      aria-label="Accounts created per day"
    >
      <BarChart accessibilityLayer data={signups} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <Bar
          dataKey="users"
          fill="var(--color-users)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
