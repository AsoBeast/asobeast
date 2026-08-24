"use client";

import { Suspense } from "react";
import { OVERALL_GENRE, type CategoryRankSeriesItem } from "@asobeast/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import { SeriesLegend } from "@/components/charts/SeriesLegend";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RangePicker } from "@/components/rankings/RangePicker";
import { formatCategoryPosition, formatDayMonth } from "@/lib/format";
import { categoryRanksOptions } from "@/lib/queries";
import { presetToRange, RANGE_PRESETS, type RangePreset } from "@/lib/ranges";
import { rangeParser } from "@/lib/search-params";
import { MAX_SERIES } from "@/components/rankings/pivot";
import { ChartNotice, ChartSkeleton } from "@/components/charts/ChartStates";
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

const Y_TICKS = [1, 25, 50, 100, 150, 200];

interface CategoryChartData {
  rows: Array<Record<string, string | number | null>>;
  config: ChartConfig;
  seriesLabels: Record<string, string>;
  keys: string[];
  totalSeries: number;
}

function seriesKey(item: CategoryRankSeriesItem): string {
  return `${item.collection}_${item.genre}`;
}

function buildCategoryChart(all: CategoryRankSeriesItem[]): CategoryChartData {
  const series = all.slice(0, MAX_SERIES);
  const dates = new Set<string>();
  for (const item of series) {
    for (const point of item.points) dates.add(point.date);
  }
  const sortedDates = [...dates].sort();

  const config: ChartConfig = {};
  const seriesLabels: Record<string, string> = {};
  series.forEach((item, index) => {
    const label = `${item.genreName} · ${item.collection}`;
    config[seriesKey(item)] = { label, color: seriesColor(index) };
    seriesLabels[seriesKey(item)] = label;
  });

  const rows = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const item of series) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[seriesKey(item)] = point ? point.position : null;
    }
    return row;
  });

  return {
    rows,
    config,
    seriesLabels,
    keys: series.map(seriesKey),
    totalSeries: all.length,
  };
}

function primaryGenreItem(
  series: CategoryRankSeriesItem[],
): CategoryRankSeriesItem | undefined {
  return series.find((item) => item.genre !== OVERALL_GENRE);
}

function CategoryTooltip({
  active,
  label,
  data,
}: {
  active?: boolean;
  label?: string | number;
  data: CategoryChartData;
}) {
  if (!active || label === undefined) return null;
  const row = data.rows.find((candidate) => candidate.date === label);
  if (!row) return null;

  const items = data.keys.map((key, index) => {
    const value = row[key];
    const position = typeof value === "number" ? value : null;
    return {
      key,
      index,
      color: data.config[key]?.color,
      label: data.config[key]?.label ?? key,
      value: formatCategoryPosition(position),
      sortBy: position ?? Infinity,
    };
  });

  return <SeriesTooltip title={formatDayMonth(String(label))} items={items} />;
}

function HeaderStat({ series }: { series: CategoryRankSeriesItem[] }) {
  const primary = primaryGenreItem(series);
  if (!primary) return null;

  return (
    <p className="text-sm">
      {primary.current === null ? (
        <span className="text-muted-foreground">
          Not in top 200 in {primary.genreName}
        </span>
      ) : (
        <>
          <span className="font-mono text-lg font-semibold numeric font-mono">
            #{primary.current}
          </span>{" "}
          <span className="text-muted-foreground">in {primary.genreName}</span>
        </>
      )}
    </p>
  );
}

function CategoryRankBody({ id, range }: { id: string; range: RangePreset }) {
  const { data } = useSuspenseQuery(
    categoryRanksOptions(id, presetToRange(range)),
  );

  if (data.series.length === 0) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.tall}
        title="No category captures yet"
        body="Chart positions are captured by the daily pipeline."
      />
    );
  }

  const chart = buildCategoryChart(data.series);

  return (
    <div className="flex flex-col gap-4">
      <HeaderStat series={data.series} />
      <ChartContainer
        config={chart.config}
        className={`${CHART_HEIGHT.tall} w-full`}
        role="region"
        aria-label="Category chart position over time"
      >
        <LineChart accessibilityLayer data={chart.rows} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...TIME_AXIS_PROPS} />
          <YAxis
            {...VALUE_AXIS_PROPS}
            reversed
            domain={[1, 200]}
            ticks={Y_TICKS}
            width={40}
            allowDataOverflow
          />
          <ChartTooltip content={<CategoryTooltip data={chart} />} />
          <ChartLegend
            content={
              <SeriesLegend labels={chart.seriesLabels} order={chart.keys} />
            }
          />
          {chart.keys.map((key, index) => (
            <Line
              {...LINE_PROPS}
              key={key}
              dataKey={key}
              stroke={`var(--color-${key})`}
              strokeDasharray={seriesDash(index)}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export function CategoryRankCard({ id }: { id: string }) {
  const [range, setRange] = useQueryState("categoryRange", rangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Category ranks</CardDescription>
        <CardTitle>Top charts position</CardTitle>
        <CardAction>
          <RangePicker
            presets={RANGE_PRESETS}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.tall} />}>
          <CategoryRankBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
