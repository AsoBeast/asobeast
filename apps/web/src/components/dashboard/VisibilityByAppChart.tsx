"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import { SeriesFade, useFadeId } from "@/components/charts/SeriesFade";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  seriesDash,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { formatDayMonth, formatNumber } from "@/lib/format";
import type { PortfolioVisibility } from "./visibility-series";

type Row = PortfolioVisibility["rows"][number];

function configOf(series: PortfolioVisibility["series"]): ChartConfig {
  return Object.fromEntries(
    series.map((entry, index) => [
      entry.key,
      { label: entry.label, color: seriesColor(index) },
    ]),
  );
}

function VisibilityTooltip({
  active,
  label,
  rows,
  series,
}: {
  active?: boolean;
  label?: string | number;
  rows: Row[];
  series: PortfolioVisibility["series"];
}) {
  if (!active || label === undefined) return null;
  const row = rows.find((candidate) => candidate.date === label);
  if (!row) return null;
  const items = series.flatMap((entry, index) => {
    const value = row[entry.key];
    return typeof value === "number"
      ? [
          {
            key: entry.key,
            index,
            color: seriesColor(index),
            label: entry.label,
            value: formatNumber(value),
            sortBy: -value,
          },
        ]
      : [];
  });
  return <SeriesTooltip title={formatDayMonth(String(label))} items={items} />;
}

export function ChartLegend({
  series,
}: {
  series: PortfolioVisibility["series"];
}) {
  if (series.length < 2) return null;
  return (
    <ul
      aria-label="Charted apps"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      {series.map((entry, index) => (
        <li key={entry.key} className="flex min-w-0 items-center gap-1.5">
          <svg aria-hidden width="16" height="8" viewBox="0 0 16 8">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke={seriesColor(index)}
              strokeWidth="2"
              strokeDasharray={seriesDash(index)}
            />
          </svg>
          <bdi className="truncate">{entry.label}</bdi>
        </li>
      ))}
    </ul>
  );
}

export function VisibilityByAppChart({ data }: { data: PortfolioVisibility }) {
  const fadeId = useFadeId();
  const height = CHART_HEIGHT.tall;

  const state = trendState(data.days);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={height}
        title={
          state === "empty"
            ? "No visibility recorded yet"
            : "Not enough history yet"
        }
        body="The trend appears after a few daily runs."
      />
    );
  }

  const tooltip = (
    <ChartTooltip
      content={<VisibilityTooltip rows={data.rows} series={data.series} />}
    />
  );
  const axes = (
    <>
      <CartesianGrid {...GRID_PROPS} />
      <XAxis {...TIME_AXIS_PROPS} />
      <YAxis {...VALUE_AXIS_PROPS} />
    </>
  );

  return (
    <ChartContainer
      config={configOf(data.series)}
      className={`${height} w-full`}
      role="region"
      aria-label="Visibility by app over the last 30 days"
    >
      {data.series.length === 1 ? (
        <AreaChart accessibilityLayer data={data.rows} margin={CHART_MARGIN}>
          <SeriesFade id={fadeId} color={seriesColor(0)} />
          {axes}
          {tooltip}
          <Area
            {...LINE_PROPS}
            dataKey={data.series[0].key}
            stroke={seriesColor(0)}
            fill={`url(#${fadeId})`}
          />
        </AreaChart>
      ) : (
        <LineChart accessibilityLayer data={data.rows} margin={CHART_MARGIN}>
          {axes}
          {tooltip}
          {data.series.map((entry, index) => (
            <Line
              key={entry.key}
              {...LINE_PROPS}
              dataKey={entry.key}
              stroke={seriesColor(index)}
              strokeDasharray={seriesDash(index)}
            />
          ))}
        </LineChart>
      )}
    </ChartContainer>
  );
}
