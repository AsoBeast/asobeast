"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import {
  BAR_PROPS,
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
import { formatNumber } from "@/lib/format";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, type RatingsRange } from "@/lib/ranges";
import { latestRatingCount, newRatings } from "./ratings-volume";

const HEIGHT = CHART_HEIGHT.tall;

const chartConfig = {
  added: { label: "New ratings", color: seriesColor(0) },
} satisfies ChartConfig;

export function NewRatingsChart({
  id,
  range,
}: {
  id: string;
  range: RatingsRange;
}) {
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const bars = newRatings(data.points);
  const latest = latestRatingCount(data.points);

  const state = trendState(bars.length);
  if (latest === null || state === "empty") {
    return (
      <ChartNotice
        height={HEIGHT}
        title="No ratings history yet"
        body="The daily pipeline stores the number of ratings with each snapshot."
      />
    );
  }
  if (state === "insufficient") {
    return (
      <ChartStat
        height={HEIGHT}
        label="Ratings so far"
        value={formatNumber(latest)}
        note="Daily bars need a few more daily snapshots."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${HEIGHT} w-full`}
      role="region"
      aria-label="New ratings per day"
    >
      <BarChart accessibilityLayer data={bars} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          allowDecimals={false}
          tickFormatter={(value: number) => formatNumber(value)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <Bar {...BAR_PROPS} dataKey="added" fill="var(--color-added)" />
      </BarChart>
    </ChartContainer>
  );
}
