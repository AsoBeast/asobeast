"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
  TIME_AXIS_PROPS,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { rankDistributionHistoryOptions } from "@/lib/queries";
import {
  presetToRange,
  VISIBILITY_RANGES,
  type VisibilityRange,
} from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";

const BANDS = [
  { key: "rank1", label: "#1", color: "var(--rank-band-1)" },
  { key: "rank2to3", label: "#2–3", color: "var(--rank-band-2)" },
  { key: "rank4to10", label: "#4–10", color: "var(--rank-band-3)" },
  { key: "rank11to50", label: "#11–50", color: "var(--rank-band-4)" },
  { key: "rank51plus", label: "#51+", color: "var(--rank-band-5)" },
  { key: "unranked", label: "Unranked", color: "var(--muted-foreground)" },
] as const;

const chartConfig = Object.fromEntries(
  BANDS.map((band) => [band.key, { label: band.label, color: band.color }]),
) satisfies ChartConfig;

function RankDistributionHistoryBody({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { data } = useSuspenseQuery(
    rankDistributionHistoryOptions(id, presetToRange(range)),
  );

  const state = trendState(data.points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title="No rank history yet"
        body="Bands appear once the daily pipeline has checked your keywords."
      />
    );
  }
  if (state === "insufficient") {
    const latest = data.points[data.points.length - 1];
    return (
      <ChartStat
        height={CHART_HEIGHT.compact}
        label="Keywords in the top 10"
        value={String(latest.rank1 + latest.rank2to3 + latest.rank4to10)}
        note="A trend needs a few more daily checks."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label="Tracked keywords by rank band"
    >
      <AreaChart accessibilityLayer data={data.points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {BANDS.map((band) => (
          <Area
            key={band.key}
            dataKey={band.key}
            type="monotone"
            stackId="bands"
            stroke={`var(--color-${band.key})`}
            fill={`var(--color-${band.key})`}
            fillOpacity={0.7}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

export function RankDistributionHistoryChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("distRange", visibilityRangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Rank distribution history</CardDescription>
        <CardTitle>Tracked keywords by rank band</CardTitle>
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
          <RankDistributionHistoryBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
