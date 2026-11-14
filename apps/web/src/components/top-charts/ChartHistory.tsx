"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { ChartCaptureSummary, ChartPage } from "@asobeast/shared";
import { ChartNotice, ChartSkeleton } from "@/components/charts/ChartStates";
import {
  SeriesTooltip,
  type SeriesTooltipItem,
} from "@/components/charts/SeriesTooltip";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  PENDING_DOT_PROPS,
  PREVIOUS_LINE_PROPS,
  RANK_AXIS_PROPS,
  seriesColor,
  seriesDash,
  TIME_AXIS_PROPS,
} from "@/components/charts/theme";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { formatDayMonth } from "@/lib/format";
import { chartPageOptions } from "@/lib/queries";
import { shownChartKey } from "./chart-params";
import {
  chartHistory,
  HISTORY_APPS,
  historyDates,
  historyReady,
  type ChartHistory as History,
  type HistorySeries,
} from "./chart-summary";

const OWN_SUFFIX = " · yours";
const END_LABEL_ROOM = 168;
const HISTORY_MARGIN = { ...CHART_MARGIN, right: END_LABEL_ROOM } as const;
const OWN_LINE = { ...LINE_PROPS, stroke: seriesColor(0) } as const;
const RANK_TICKS = Array.from(
  { length: HISTORY_APPS },
  (_, index) => index + 1,
);
const RANK_DOMAIN = [0.5, HISTORY_APPS + 0.5];
const DAY_PADDING = { left: 16, right: 16 } as const;

const HISTORY_FOCUS_KEY = "chart-history";

const lineOf = (series: HistorySeries) =>
  series.own ? OWN_LINE : PREVIOUS_LINE_PROPS;

function patternsOf(series: readonly HistorySeries[]): Map<string, number> {
  const others = series.filter((candidate) => !candidate.own);
  return new Map(
    series.map((candidate) => [
      candidate.id,
      candidate.own ? 0 : others.indexOf(candidate) + 1,
    ]),
  );
}

const inTopOf =
  (id: string) =>
  (row: History["rows"][number]): number | null => {
    const position = row[id];
    return typeof position === "number" && position <= HISTORY_APPS
      ? position
      : null;
  };

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
  const patterns = patternsOf(history.series);
  const items: SeriesTooltipItem[] = history.series.map((series) => {
    const position = row[series.id];
    return {
      key: series.id,
      index: patterns.get(series.id) ?? 0,
      color: lineOf(series).stroke,
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
  const patterns = patternsOf(history.series);
  const claimFocus = useFocusClaim(HISTORY_FOCUS_KEY);
  return (
    <ChartContainer
      ref={claimFocus}
      tabIndex={-1}
      config={{}}
      className={`${CHART_HEIGHT.hero} w-full`}
      role="region"
      aria-label={`Positions of the top ${history.series.length} apps over ${history.rows.length} captured days`}
    >
      <LineChart accessibilityLayer data={history.rows} margin={HISTORY_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} padding={DAY_PADDING} />
        <YAxis {...RANK_AXIS_PROPS} domain={RANK_DOMAIN} ticks={RANK_TICKS} />
        <ChartTooltip
          filterNull={false}
          content={<HistoryTooltip history={history} />}
        />
        {ordered.map((series) => (
          <Line
            {...lineOf(series)}
            key={series.id}
            type="linear"
            name={series.id}
            dataKey={inTopOf(series.id)}
            strokeDasharray={seriesDash(patterns.get(series.id) ?? 0)}
            dot={PENDING_DOT_PROPS}
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
  const ready = historyReady(page.dates, page.capture.date);
  const earlier = ready
    ? dates.filter((date) => date !== page.capture.date)
    : [];
  const reads = useQueries({
    queries: earlier.map((date) =>
      chartPageOptions({
        ...shownChartKey(page),
        compare: page.compare,
        date,
      }),
    ),
  });
  const failed = reads.filter(
    (read) => read.isError && read.data === undefined,
  );
  const days = reads.flatMap((read) => (read.data ? [read.data] : []));

  if (!ready) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="History needs four captured days"
        body={`${dates.length} captured so far. Follow the category so the daily run captures it.`}
      />
    );
  }
  if (failed.length > 0) {
    return (
      <div
        className={`${CHART_HEIGHT.hero} flex items-center justify-center`}
        onClickCapture={() => armFocusHandoff(HISTORY_FOCUS_KEY)}
      >
        <InlineQueryError
          message="Could not load the earlier captures."
          read={{
            data: undefined,
            isError: true,
            isFetching: failed.some((read) => read.isFetching),
            errorUpdatedAt: failed[0].errorUpdatedAt,
            refetch: () => Promise.all(failed.map((read) => read.refetch())),
          }}
        />
      </div>
    );
  }
  if (days.length < earlier.length) {
    return <ChartSkeleton height={CHART_HEIGHT.hero} />;
  }
  return <HistoryPlot history={chartHistory([...days, page], page)} />;
}
