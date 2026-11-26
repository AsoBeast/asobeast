"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import type { AdminSignupDay } from "@asobeast/shared";
import { ChartNotice, MIN_TREND_POINTS } from "@/components/charts/ChartStates";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  seriesColor,
  timeAxisPropsInLocale,
  timeTooltipPropsInLocale,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useAppLocale } from "@/lib/use-app-locale";

const activeDays = (days: AdminSignupDay[]) =>
  days.filter((day) => day.users > 0).length;

export function SignupsChart({ signups }: { signups: AdminSignupDay[] }) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const chartConfig = {
    users: { label: t("overview.chart.series"), color: seriesColor(0) },
  } satisfies ChartConfig;

  if (activeDays(signups) < MIN_TREND_POINTS) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title={t("overview.chart.tooFew")}
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label={t("overview.chart.region")}
    >
      <BarChart accessibilityLayer data={signups} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...timeAxisPropsInLocale(locale)} />
        <YAxis {...VALUE_AXIS_PROPS} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent {...timeTooltipPropsInLocale(locale)} />
          }
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
