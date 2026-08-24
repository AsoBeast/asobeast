"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  TIME_AXIS_PROPS,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { visibilityOptions } from "@/lib/queries";
import {
  presetToRange,
  VISIBILITY_RANGES,
  type VisibilityRange,
} from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";

const chartConfig = {
  visibility: { label: "Visibility", color: seriesColor(0) },
} satisfies ChartConfig;

function VisibilityChartBody({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { data } = useSuspenseQuery(
    visibilityOptions(id, presetToRange(range)),
  );

  const state = trendState(data.points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title="No visibility recorded yet"
        body="The daily pipeline captures your first point within 24 hours."
      />
    );
  }
  if (state === "insufficient") {
    const latest = data.points[data.points.length - 1];
    return (
      <ChartStat
        height={CHART_HEIGHT.compact}
        label="Latest visibility"
        value={String(latest.visibility)}
        note="A trend line needs a few more daily checks."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label="Search visibility over time"
    >
      <AreaChart accessibilityLayer data={data.points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} />
        <ChartTooltip
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <Area
          dataKey="visibility"
          type="monotone"
          stroke="var(--color-visibility)"
          fill="var(--color-visibility)"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function VisibilityChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", visibilityRangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Visibility history</CardDescription>
        <CardTitle>Search visibility over time</CardTitle>
        <CardAction>
          <RangePicker
            presets={VISIBILITY_RANGES}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.compact} />}>
          <VisibilityChartBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
