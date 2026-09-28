"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { ActionItem, ActionTrend } from "@asobeast/shared";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  seriesDash,
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
import { trendChartData } from "./action-trend-chart";

export function ActionTrendChart({
  trend,
  item,
}: {
  trend: ActionTrend;
  item: ActionItem;
}) {
  const data = trendChartData(trend, item);
  const state = trendState(data.plotted);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title={
          state === "empty"
            ? "No history for this action"
            : "Not enough history yet"
        }
        body={data.summary}
      />
    );
  }

  const config = {
    value: { label: data.metricLabel, color: seriesColor(0) },
  } satisfies ChartConfig;

  return (
    <div>
      <ChartContainer
        config={config}
        className={`${CHART_HEIGHT.compact} w-full`}
        role="region"
        aria-label={`${data.metricLabel} over time`}
      >
        <LineChart accessibilityLayer data={data.rows} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...TIME_AXIS_PROPS} />
          <YAxis
            {...VALUE_AXIS_PROPS}
            reversed={data.reversed}
            domain={data.domain}
            allowDataOverflow
          />
          {data.markers.map((marker) => (
            <ReferenceLine
              key={marker.label}
              x={marker.date}
              stroke="var(--muted-foreground)"
              strokeDasharray={seriesDash(1)}
              label={{
                value: marker.label,
                position: "insideTopLeft",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
          ))}
          <ChartTooltip
            content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
          />
          <Line
            {...LINE_PROPS}
            dataKey="value"
            stroke="var(--color-value)"
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>
      <p className="sr-only">{data.summary}</p>
    </div>
  );
}
