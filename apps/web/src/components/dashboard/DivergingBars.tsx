"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartKey } from "@/components/charts/ChartKey";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  BAR_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
  ZERO_LINE_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { formatDayMonth, formatNumber } from "@/lib/format";
import type { DivergingTrend } from "./history-trend";

export interface DivergingSubject {
  region: string;
  waiting: string;
  up: { label: string; color: string };
  down: { label: string; color: string };
}

function DivergingTooltip({
  active,
  label,
  trend,
  subject,
}: {
  active?: boolean;
  label?: string | number;
  trend: DivergingTrend;
  subject: DivergingSubject;
}) {
  if (!active || label === undefined) return null;
  const row = trend.rows.find((candidate) => candidate.date === label);
  if (!row) return null;
  return (
    <SeriesTooltip
      title={formatDayMonth(String(label))}
      items={
        row.checked
          ? [
              {
                key: "up",
                index: 0,
                color: subject.up.color,
                label: subject.up.label,
                value: formatNumber(row.up),
                sortBy: 0,
              },
              {
                key: "down",
                index: 0,
                color: subject.down.color,
                label: subject.down.label,
                value: formatNumber(-row.down),
                sortBy: 1,
              },
            ]
          : []
      }
      footer={
        row.checked ? null : (
          <span className="text-muted-foreground">Not checked</span>
        )
      }
    />
  );
}

export function DivergingKey({
  trend,
  subject,
}: {
  trend: DivergingTrend;
  subject: DivergingSubject;
}) {
  return (
    <ChartKey
      label="Chart bars"
      items={
        trend.checked === 0
          ? []
          : [
              { ...subject.up, mark: "square" },
              { ...subject.down, mark: "square" },
            ]
      }
    />
  );
}

export function DivergingBars({
  trend,
  subject,
}: {
  trend: DivergingTrend;
  subject: DivergingSubject;
}) {
  const height = CHART_HEIGHT.tall;
  const state = trendState(trend.checked);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={height}
        title={
          state === "empty" ? "Nothing recorded yet" : "Not enough history yet"
        }
        body={subject.waiting}
      />
    );
  }

  const config: ChartConfig = {
    up: { label: subject.up.label, color: subject.up.color },
    down: { label: subject.down.label, color: subject.down.color },
  };

  return (
    <ChartContainer
      config={config}
      className={`${height} w-full`}
      role="region"
      aria-label={`${subject.region} over the last ${trend.days} days`}
    >
      <BarChart
        accessibilityLayer
        data={trend.rows}
        margin={CHART_MARGIN}
        stackOffset="sign"
      >
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} ticks={trend.dayTicks} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          domain={trend.domain}
          ticks={trend.valueTicks}
          allowDecimals={false}
          tickFormatter={(value: number) => formatNumber(Math.abs(value))}
        />
        <ReferenceLine y={0} {...ZERO_LINE_PROPS} />
        <ChartTooltip
          content={<DivergingTooltip trend={trend} subject={subject} />}
        />
        <Bar
          {...BAR_PROPS}
          dataKey="up"
          stackId="pair"
          fill={subject.up.color}
        />
        <Bar
          {...BAR_PROPS}
          dataKey="down"
          stackId="pair"
          fill={subject.down.color}
        />
      </BarChart>
    </ChartContainer>
  );
}
