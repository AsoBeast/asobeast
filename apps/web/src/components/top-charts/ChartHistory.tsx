"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { ChartCaptureSummary, ChartPage } from "@asobeast/shared";
import {
  ChartNotice,
  ChartSkeleton,
  trendState,
} from "@/components/charts/ChartStates";
import {
  SeriesTooltip,
  type SeriesTooltipItem,
} from "@/components/charts/SeriesTooltip";
import {
  CHART_HEIGHT,
  GRID_PROPS,
  LINE_PROPS,
  RANK_AXIS_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
} from "@/components/charts/theme";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatDayMonth } from "@/lib/format";
import { chartPageOptions } from "@/lib/queries";
import { shownChartKey } from "./chart-params";
import {
  chartHistory,
  HISTORY_APPS,
  historyDates,
  type ChartHistory as History,
  type HistorySeries,
} from "./chart-summary";

const OTHER_COLOR = "var(--chart-6)";
const OWN_SUFFIX = " · yours";
const HISTORY_MARGIN = { left: 4, right: 168, top: 12, bottom: 4 } as const;
const RANK_TICKS = Array.from(
  { length: HISTORY_APPS },
  (_, index) => index + 1,
);
const RANK_DOMAIN = [0.5, HISTORY_APPS + 0.5];
const DAY_PADDING = { left: 16, right: 16 } as const;

const colorOf = (series: HistorySeries) =>
  series.own ? seriesColor(0) : OTHER_COLOR;

const LABEL_LENGTH = 20;

const labelOf = (series: HistorySeries) =>
  series.own ? `${series.title}${OWN_SUFFIX}` : series.title;

function endLabelOf(series: HistorySeries): string {
  const title =
    series.title.length > LABEL_LENGTH
      ? `${series.title.slice(0, LABEL_LENGTH - 1).trimEnd()}…`
      : series.title;
  return labelOf({ ...series, title });
}

function EndLabel({
  x,
  y,
  index,
  last,
  series,
}: {
  x?: number;
  y?: number;
  index?: number;
  last: number;
  series: HistorySeries;
}) {
  if (index !== last || x === undefined || y === undefined) return null;
  return (
    <text
      x={x + 12}
      y={y}
      dominantBaseline="central"
      className={
        series.own
          ? "fill-foreground text-label"
          : "fill-muted-foreground text-caption"
      }
    >
      {endLabelOf(series)}
    </text>
  );
}

function HistoryTooltip({
  active,
  label,
  history,
}: {
  active?: boolean;
  label?: string | number;
  history: History;
}) {
  const row = history.rows.find((candidate) => candidate.date === label);
  if (!active || !row) return null;
  const items: SeriesTooltipItem[] = history.series.map((series) => {
    const position = row[series.id];
    return {
      key: series.id,
      index: 0,
      color: colorOf(series),
      label: labelOf(series),
      value: typeof position === "number" ? `#${position}` : "Not listed",
      sortBy: typeof position === "number" ? position : Infinity,
    };
  });
  return <SeriesTooltip title={formatDayMonth(row.date)} items={items} />;
}

function HistoryPlot({ history }: { history: History }) {
  const last = history.rows.length - 1;
  const ordered = [...history.series].sort(
    (a, b) => Number(a.own) - Number(b.own),
  );
  return (
    <ChartContainer
      config={{}}
      className={`${CHART_HEIGHT.hero} w-full`}
      role="region"
      aria-label={`Positions of the top ${history.series.length} apps over ${history.rows.length} captured days`}
    >
      <LineChart accessibilityLayer data={history.rows} margin={HISTORY_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} padding={DAY_PADDING} />
        <YAxis
          {...RANK_AXIS_PROPS}
          scale="linear"
          domain={RANK_DOMAIN}
          ticks={RANK_TICKS}
        />
        <ChartTooltip
          filterNull={false}
          content={<HistoryTooltip history={history} />}
        />
        {ordered.map((series) => (
          <Line
            {...LINE_PROPS}
            key={series.id}
            type="linear"
            dataKey={series.id}
            stroke={colorOf(series)}
            strokeWidth={series.own ? 2.5 : 1.25}
            dot={{ r: series.own ? 3.5 : 2.5, fill: "var(--card)" }}
            connectNulls={false}
            label={<EndLabel last={last} series={series} />}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function ChartHistory({
  page,
}: {
  page: ChartPage & { capture: ChartCaptureSummary };
}) {
  const dates = useMemo(
    () => historyDates(page.dates, page.capture.date),
    [page.dates, page.capture.date],
  );
  const earlier = dates.filter((date) => date !== page.capture.date);
  const reads = useQueries({
    queries: earlier.map((date) =>
      chartPageOptions({
        ...shownChartKey(page),
        compare: page.compare,
        date,
      }),
    ),
  });
  const failed = reads.find((read) => read.isError && read.data === undefined);
  const days = reads.flatMap((read) => (read.data ? [read.data] : []));

  if (trendState(dates.length) !== "ready") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="History needs four captured days"
        body={`${dates.length} captured so far. Follow the category so the daily run captures it.`}
      />
    );
  }
  if (failed) {
    return (
      <div className={`${CHART_HEIGHT.hero} flex items-center justify-center`}>
        <InlineQueryError
          message="Could not load the earlier captures."
          read={failed}
        />
      </div>
    );
  }
  if (days.length < earlier.length) {
    return <ChartSkeleton height={CHART_HEIGHT.hero} />;
  }
  return <HistoryPlot history={chartHistory([...days, page], page)} />;
}
