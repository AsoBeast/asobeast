"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  type DotItemDotProps,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { SeriesLegend } from "@/components/charts/SeriesLegend";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesDash,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { newRatingsAverageSeries } from "@/components/reviews/new-ratings-average";
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import { formatRating } from "@/lib/format";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, type RatingsRange } from "@/lib/ranges";
import {
  isLoneNewAverage,
  ratedPoints,
  ratingAxis,
  withNewRatings,
} from "./rating-trend";
import {
  RATING_CHART_CONFIG,
  RATING_SERIES_LABELS,
  RATING_SERIES_ORDER,
  RatingTooltip,
} from "./RatingTooltip";

const HEIGHT = CHART_HEIGHT.tall;

const LONE_DOT_RADIUS = 2.5;

export function RatingTrendChart({
  id,
  range,
  newRatings = false,
}: {
  id: string;
  range: RatingsRange;
  newRatings?: boolean;
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

  const rows = withNewRatings(
    points,
    newRatings ? newRatingsAverageSeries(data.points) : [],
  );
  const newValues = rows.map((row) => row.newAverage);
  const twoLines = newValues.some((value) => value !== null);
  const axis = ratingAxis(points, newValues);
  const loneDot = ({ cx, cy, index }: DotItemDotProps) =>
    isLoneNewAverage(rows, index) && cx !== undefined && cy !== undefined ? (
      <circle
        cx={cx}
        cy={cy}
        r={LONE_DOT_RADIUS}
        fill="var(--color-newAverage)"
      />
    ) : null;

  return (
    <ChartContainer
      config={RATING_CHART_CONFIG}
      className={`${HEIGHT} w-full`}
      role="region"
      aria-label="Average rating over time"
    >
      <LineChart accessibilityLayer data={rows} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          domain={axis.domain}
          ticks={axis.ticks}
          interval={0}
          tickFormatter={(value: number) => formatRating(value)}
        />
        <ChartTooltip content={<RatingTooltip rows={rows} />} />
        {twoLines ? (
          <ChartLegend
            itemSorter={null}
            content={
              <SeriesLegend
                labels={RATING_SERIES_LABELS}
                order={RATING_SERIES_ORDER}
              />
            }
          />
        ) : null}
        <Line
          {...LINE_PROPS}
          dataKey="ratingAvg"
          stroke="var(--color-ratingAvg)"
        />
        {twoLines ? (
          <Line
            {...LINE_PROPS}
            dataKey="newAverage"
            stroke="var(--color-newAverage)"
            strokeDasharray={seriesDash(1)}
            connectNulls={false}
            dot={loneDot}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
