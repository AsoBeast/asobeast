"use client";

import type { ReactElement } from "react";
import type { RankDistributionPoint } from "@asobeast/shared";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useAppLocale } from "@/lib/use-app-locale";
import { RANK_BANDS, topTenOf, UNRANKED_BAND } from "./rank-bands";
import {
  CHANGE_MARKER_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  COUNT_LINE_PROPS,
  GRID_PROPS,
  timeAxisPropsInLocale,
  timeTooltipPropsInLocale,
  TOP_TEN_EDGE_PROPS,
  VALUE_AXIS_PROPS,
} from "./theme";

export const PLOTTED_BANDS = [...RANK_BANDS, UNRANKED_BAND];

const chartConfig = Object.fromEntries(
  PLOTTED_BANDS.map((band) => [
    band.key,
    { label: band.label, color: band.color },
  ]),
) satisfies ChartConfig;

export function RankBandsPlot({
  points,
  label,
  ticks,
  markers = [],
  edge = false,
  tooltip,
}: {
  points: RankDistributionPoint[];
  label: string;
  ticks?: string[];
  markers?: readonly string[];
  edge?: boolean;
  tooltip?: ReactElement;
}) {
  const locale = useAppLocale();
  const shownTooltip = tooltip ?? (
    <ChartTooltipContent {...timeTooltipPropsInLocale(locale)} />
  );
  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.tall} w-full`}
      role="region"
      aria-label={label}
    >
      <ComposedChart accessibilityLayer data={points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...timeAxisPropsInLocale(locale)} ticks={ticks} />
        <YAxis {...VALUE_AXIS_PROPS} allowDecimals={false} />
        <ChartTooltip content={shownTooltip} />
        {PLOTTED_BANDS.map((band) => (
          <Area
            key={band.key}
            dataKey={band.key}
            type={COUNT_LINE_PROPS.type}
            stackId="bands"
            stroke="var(--card)"
            strokeWidth={1}
            fill={`var(--color-${band.key})`}
            fillOpacity={1}
            isAnimationActive={false}
          />
        ))}
        {edge ? (
          <Line
            {...TOP_TEN_EDGE_PROPS}
            type={COUNT_LINE_PROPS.type}
            dataKey={topTenOf}
          />
        ) : null}
        {markers.map((day) => (
          <ReferenceLine key={day} x={day} {...CHANGE_MARKER_PROPS} />
        ))}
      </ComposedChart>
    </ChartContainer>
  );
}
