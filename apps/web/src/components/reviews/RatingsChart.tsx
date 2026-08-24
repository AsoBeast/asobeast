"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RangePicker } from "@/components/rankings/RangePicker";
import {
  ChartNotice,
  ChartSkeleton,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
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
import { formatRating } from "@/lib/format";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, RATINGS_RANGES, type RatingsRange } from "@/lib/ranges";
import { ratingsRangeParser } from "@/lib/search-params";

const chartConfig = {
  ratingAvg: { label: "Average rating", color: seriesColor(0) },
  ratingCount: { label: "Rating count", color: seriesColor(1) },
} satisfies ChartConfig;

function RatingsChartBody({ id, range }: { id: string; range: RatingsRange }) {
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );

  const state = trendState(data.points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title="No ratings history yet"
        body="Snapshots accrue with the daily pipeline."
      />
    );
  }
  if (state === "insufficient") {
    const latest = data.points[data.points.length - 1];
    return (
      <ChartStat
        height={CHART_HEIGHT.compact}
        label="Latest average rating"
        value={latest.ratingAvg === null ? "—" : formatRating(latest.ratingAvg)}
        note="A trend line needs a few more daily snapshots."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label="Average rating and review volume"
    >
      <LineChart accessibilityLayer data={data.points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} yAxisId="avg" domain={[0, 5]} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          yAxisId="count"
          orientation="right"
          width={40}
        />
        <ChartTooltip
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <Line
          yAxisId="avg"
          dataKey="ratingAvg"
          type="monotone"
          stroke="var(--color-ratingAvg)"
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="count"
          dataKey="ratingCount"
          type="monotone"
          stroke="var(--color-ratingCount)"
          strokeDasharray={seriesDash(1)}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

export function RatingsChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", ratingsRangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Ratings history</CardDescription>
        <CardTitle>Average rating and volume over time</CardTitle>
        <CardAction>
          <RangePicker
            presets={RATINGS_RANGES}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.compact} />}>
          <RatingsChartBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
