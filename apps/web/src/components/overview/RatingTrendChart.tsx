"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { formatDayMonth, formatRating, pluralize } from "@/lib/format";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, type VisibilityRange } from "@/lib/ranges";
import { ratedPoints, ratingAxis, type RatedPoint } from "./rating-trend";

const HEIGHT = CHART_HEIGHT.tall;

const PRECISE_DIGITS = 2;

const chartConfig = {
  ratingAvg: { label: "Average rating", color: seriesColor(0) },
} satisfies ChartConfig;

function RatingTooltip({
  active,
  label,
  points,
}: {
  active?: boolean;
  label?: string | number;
  points: RatedPoint[];
}) {
  if (!active || label === undefined) return null;
  const point = points.find((candidate) => candidate.date === label);
  if (!point) return null;
  return (
    <SeriesTooltip
      title={formatDayMonth(point.date)}
      items={[
        {
          key: "ratingAvg",
          index: 0,
          color: "var(--color-ratingAvg)",
          label: "Average rating",
          value: point.ratingAvg.toFixed(PRECISE_DIGITS),
          sortBy: 0,
        },
      ]}
      footer={
        point.ratingCount === null ? null : (
          <p className="text-muted-foreground">
            {pluralize(point.ratingCount, "rating")}
          </p>
        )
      }
    />
  );
}

export function RatingTrendChart({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const points = ratedPoints(data.points);

  const state = trendState(points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={HEIGHT}
        title="No rating recorded yet"
        body="The daily pipeline stores the rating of the home listing with each snapshot."
      />
    );
  }
  if (state === "insufficient") {
    return (
      <ChartStat
        height={HEIGHT}
        label="Latest average rating"
        value={formatRating(points[points.length - 1].ratingAvg)}
        note="A trend line needs a few more daily snapshots."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${HEIGHT} w-full`}
      role="region"
      aria-label="Average rating over time"
    >
      <LineChart accessibilityLayer data={points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          domain={ratingAxis(points)}
          tickFormatter={(value: number) => formatRating(value)}
        />
        <ChartTooltip content={<RatingTooltip points={points} />} />
        <Line
          {...LINE_PROPS}
          dataKey="ratingAvg"
          stroke="var(--color-ratingAvg)"
        />
      </LineChart>
    </ChartContainer>
  );
}
