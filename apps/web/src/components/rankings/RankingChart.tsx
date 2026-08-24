"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { formatRankPosition, RANK_DEPTH } from "@asobeast/shared";
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import { SeriesLegend } from "@/components/charts/SeriesLegend";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesDash,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { formatDayMonth } from "@/lib/format";
import { notFoundKey, type RankingChartData } from "./pivot";

const Y_TICKS = [1, 10, 25, 50, 100, 200];

const RANK_BANDS = [
  { from: 1, to: 3, fill: "var(--rank-band-1)", label: "Top 3" },
  { from: 3, to: 10, fill: "var(--rank-band-2)", label: "Top 10" },
  { from: 10, to: 25, fill: "var(--rank-band-3)", label: "Top 25" },
] as const;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function RankingTooltip({
  active,
  label,
  data,
}: {
  active?: boolean;
  label?: string | number;
  data: RankingChartData;
}) {
  if (!active || label === undefined) return null;

  const rowIndex = data.rows.findIndex((candidate) => candidate.date === label);
  const row = data.rows[rowIndex];
  const depths = data.depths[rowIndex];
  if (!row || !depths) return null;

  const items = data.keywordIds.map((keywordId, index) => {
    const value = row[keywordId];
    const position = typeof value === "number" ? value : null;
    return {
      key: keywordId,
      index,
      color: data.config[keywordId]?.color,
      label: data.config[keywordId]?.label ?? keywordId,
      value: formatRankPosition(position, depths[keywordId] ?? undefined),
      sortBy: position ?? Infinity,
    };
  });

  return <SeriesTooltip title={formatDayMonth(String(label))} items={items} />;
}

export function RankingChart({
  data,
  changeDates = [],
}: {
  data: RankingChartData;
  changeDates?: string[];
}) {
  const today = todayUtc();
  const plotted = new Set(data.rows.map((row) => String(row.date)));
  const marked = changeDates.filter(
    (date) => date !== today && plotted.has(date),
  );

  return (
    <ChartContainer
      config={data.config}
      className={`${CHART_HEIGHT.hero} w-full`}
      role="region"
      aria-label="Keyword rank positions"
    >
      <LineChart accessibilityLayer data={data.rows} margin={CHART_MARGIN}>
        {RANK_BANDS.map((band) => (
          <ReferenceArea
            key={band.label}
            y1={band.from}
            y2={band.to}
            fill={band.fill}
            fillOpacity={0.08}
            ifOverflow="hidden"
            label={{
              value: band.label,
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />
        ))}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          reversed
          domain={[1, RANK_DEPTH]}
          ticks={Y_TICKS}
          width={36}
          allowDataOverflow
        />
        {marked.map((date) => (
          <ReferenceLine
            key={date}
            x={date}
            stroke="var(--warning)"
            strokeDasharray="4 3"
            label={{
              value: "Metadata change",
              position: "insideBottomLeft",
              angle: -90,
              fill: "var(--warning)",
              fontSize: 10,
            }}
          />
        ))}
        {plotted.has(today) ? (
          <ReferenceLine
            x={today}
            stroke="var(--muted-foreground)"
            strokeDasharray="2 4"
            label={{
              value: "Today",
              position: "insideTopLeft",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />
        ) : null}
        <ChartTooltip content={<RankingTooltip data={data} />} />
        <ChartLegend
          content={
            <SeriesLegend labels={data.seriesLabels} order={data.keywordIds} />
          }
        />
        {data.keywordIds.map((keywordId, index) => (
          <Line
            {...LINE_PROPS}
            key={keywordId}
            dataKey={keywordId}
            stroke={`var(--color-${keywordId})`}
            strokeDasharray={seriesDash(index)}
            connectNulls={false}
          />
        ))}
        {data.keywordIds.map((keywordId) => (
          <Line
            key={notFoundKey(keywordId)}
            dataKey={notFoundKey(keywordId)}
            type="monotone"
            stroke="transparent"
            legendType="none"
            connectNulls={false}
            isAnimationActive={false}
            activeDot={false}
            dot={{
              r: 3,
              fill: "var(--background)",
              stroke: `var(--color-${keywordId})`,
              strokeWidth: 1.5,
            }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
