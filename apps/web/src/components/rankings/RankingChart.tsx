"use client";

import type { Ref } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { formatCheckedPosition, RANK_DEPTH } from "@asobeast/shared";
import type { AppAnnotationItem } from "@asobeast/shared";
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import { SeriesLegend } from "@/components/charts/SeriesLegend";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import { AnnotationTooltipNotes } from "@/components/annotations/AnnotationTooltipNotes";
import {
  annotationLines,
  annotationsOn,
} from "@/components/annotations/annotation-lines";
import {
  CHANGE_MARKER_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  RANK_AXIS_PROPS,
  seriesDash,
  TIME_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  markerLineProps,
  RANK_TICKS,
  rankTierAreas,
} from "@/components/charts/rank-layers";
import { formatDayMonth } from "@/lib/format";
import { todayUtc } from "@/lib/ranges";
import {
  loneKey,
  NOT_CHECKED,
  notFoundKey,
  type RankingChartData,
} from "./pivot";

function RankingTooltip({
  active,
  label,
  data,
  annotations,
}: {
  active?: boolean;
  label?: string | number;
  data: RankingChartData;
  annotations: AppAnnotationItem[];
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
      value:
        formatCheckedPosition(position, depths[keywordId] ?? null) ??
        NOT_CHECKED,
      sortBy: position ?? Infinity,
    };
  });

  return (
    <SeriesTooltip
      title={formatDayMonth(String(label))}
      items={items}
      footer={
        <AnnotationTooltipNotes
          annotations={annotationsOn(annotations, String(label))}
        />
      }
    />
  );
}

export function RankingChart({
  data,
  changeDates = [],
  annotations = [],
  chartRef,
}: {
  data: RankingChartData;
  changeDates?: string[];
  annotations?: AppAnnotationItem[];
  chartRef?: Ref<HTMLDivElement>;
}) {
  const today = todayUtc();
  const plotted = new Set(data.rows.map((row) => String(row.date)));
  const marked = changeDates.filter(
    (date) => date !== today && plotted.has(date),
  );
  const annotated = annotationLines(annotations, [...plotted], today);

  return (
    <ChartContainer
      ref={chartRef}
      config={data.config}
      className={`${CHART_HEIGHT.hero} w-full`}
      role="region"
      aria-label="Keyword rank positions"
    >
      <LineChart accessibilityLayer data={data.rows} margin={CHART_MARGIN}>
        {rankTierAreas()}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...RANK_AXIS_PROPS}
          domain={[1, RANK_DEPTH]}
          ticks={RANK_TICKS}
        />
        {marked.map((date) => (
          <ReferenceLine
            key={date}
            x={date}
            {...CHANGE_MARKER_PROPS}
            label={{
              value: "Metadata change",
              position: "insideBottomLeft",
              angle: -90,
              fill: "var(--warning)",
              fontSize: 10,
            }}
          />
        ))}
        {annotated.map((annotation) => (
          <ReferenceLine
            key={annotation.id}
            x={annotation.date}
            stroke="var(--info)"
            strokeDasharray="6 3"
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
        <ChartTooltip
          filterNull={false}
          content={<RankingTooltip data={data} annotations={annotations} />}
        />
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
            {...markerLineProps(
              notFoundKey(keywordId),
              keywordId,
              "var(--background)",
            )}
          />
        ))}
        {data.keywordIds.map((keywordId) => (
          <Line
            key={loneKey(keywordId)}
            {...markerLineProps(
              loneKey(keywordId),
              keywordId,
              `var(--color-${keywordId})`,
            )}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
