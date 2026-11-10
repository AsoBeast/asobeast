"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";
import { ChartKey, type ChartKeyItem } from "@/components/charts/ChartKey";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import { SeriesFade, useFadeId } from "@/components/charts/SeriesFade";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  COUNT_LINE_PROPS,
  GRID_PROPS,
  LINE_PROPS,
  PENDING_DOT_PROPS,
  PENDING_LINE_PROPS,
  PREVIOUS_LINE_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { dayBefore } from "@/lib/utc-day";
import type { HistoryTrend } from "./history-trend";

const SERIES = seriesColor(0);
const PREVIOUS = PREVIOUS_LINE_PROPS.stroke;

export interface TrendSubject {
  label: string;
  region: string;
  counted: boolean;
}

const figure = (value: number): string => formatNumber(Math.round(value));

function TrendTooltip({
  active,
  label,
  trend,
  subject,
}: {
  active?: boolean;
  label?: string | number;
  trend: HistoryTrend;
  subject: TrendSubject;
}) {
  if (!active || label === undefined) return null;
  const day = String(label);
  const row = trend.rows.find((candidate) => candidate.date === day);
  if (!row) return null;
  const unfinished = day === trend.pendingDay;
  const value = unfinished ? row.pending : row.value;
  return (
    <SeriesTooltip
      title={formatDayMonth(day)}
      items={[
        ...(value === null
          ? []
          : [
              {
                key: "value",
                index: 0,
                color: SERIES,
                label: unfinished ? `${subject.label} so far` : subject.label,
                value: figure(value),
                sortBy: 0,
              },
            ]),
        ...(row.previous === null
          ? []
          : [
              {
                key: "previous",
                index: 0,
                color: PREVIOUS,
                label: formatDayMonth(dayBefore(day, trend.days)),
                value: figure(row.previous),
                sortBy: 1,
              },
            ]),
      ]}
      footer={
        unfinished ? (
          <span className="text-muted-foreground">
            Today&apos;s checks are still running
          </span>
        ) : value === null && row.previous === null ? (
          <span className="text-muted-foreground">Not checked</span>
        ) : null
      }
    />
  );
}

export function TrendLegend({ trend }: { trend: HistoryTrend }) {
  const items: ChartKeyItem[] =
    trend.checked === 0
      ? []
      : [
          { label: `Last ${trend.days} days`, color: SERIES, mark: "line" },
          ...(trend.pendingDay === null
            ? []
            : [
                {
                  label: "Still checking",
                  color: SERIES,
                  mark: "dash",
                } as const,
              ]),
          ...(trend.compared
            ? [
                {
                  label: `Previous ${trend.days} days`,
                  color: PREVIOUS,
                  mark: "line",
                } as const,
              ]
            : []),
        ];
  return <ChartKey label="Chart lines" items={items} />;
}

export function PortfolioTrendChart({
  trend,
  subject,
}: {
  trend: HistoryTrend;
  subject: TrendSubject;
}) {
  const fadeId = useFadeId();
  const height = CHART_HEIGHT.tall;

  const state = trendState(trend.checked);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={height}
        title={
          state === "empty" ? "Nothing recorded yet" : "Not enough history yet"
        }
        body="The trend appears after a few daily runs."
      />
    );
  }

  const config: ChartConfig = {
    value: { label: `Last ${trend.days} days`, color: SERIES },
    pending: { label: "Still checking", color: SERIES },
    previous: { label: `Previous ${trend.days} days`, color: PREVIOUS },
  };
  const line = subject.counted ? COUNT_LINE_PROPS : LINE_PROPS;
  const pendingRow = trend.rows.find((row) => row.date === trend.pendingDay);

  return (
    <ChartContainer
      config={config}
      className={`${height} w-full`}
      role="region"
      aria-label={`${subject.region} over the last ${trend.days} days`}
    >
      <ComposedChart accessibilityLayer data={trend.rows} margin={CHART_MARGIN}>
        <SeriesFade id={fadeId} color={SERIES} />
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} ticks={trend.dayTicks} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          domain={trend.domain}
          ticks={trend.valueTicks}
          allowDecimals={false}
        />
        <ChartTooltip
          content={<TrendTooltip trend={trend} subject={subject} />}
        />
        {trend.compared ? (
          <Line {...PREVIOUS_LINE_PROPS} type={line.type} dataKey="previous" />
        ) : null}
        <Area
          {...line}
          dataKey="value"
          stroke={SERIES}
          fill={`url(#${fadeId})`}
        />
        {pendingRow?.pending == null ? null : (
          <>
            <Line
              {...PENDING_LINE_PROPS}
              type={line.type}
              dataKey="pending"
              connectNulls
              stroke={SERIES}
              strokeWidth={LINE_PROPS.strokeWidth}
            />
            <ReferenceDot
              x={pendingRow.date}
              y={pendingRow.pending}
              {...PENDING_DOT_PROPS}
              stroke={SERIES}
            />
          </>
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
