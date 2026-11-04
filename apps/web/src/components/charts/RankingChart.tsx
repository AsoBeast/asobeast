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
import { SeriesLegend } from "./SeriesLegend";
import { SeriesTooltip } from "./SeriesTooltip";
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
} from "./theme";
import { markerLineProps, RANK_TICKS, rankTierAreas } from "./rank-layers";
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

function ChangeMarker(props: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
}) {
  const x = props.x1;
  const bottom = Math.max(props.y1, props.y2);
  return (
    <g className="metadata-change-marker" pointerEvents="none">
      <title>Metadata change</title>
      <path
        d={`M ${x - 4} ${bottom + 6} L ${x} ${bottom + 1} L ${x + 4} ${bottom + 6} Z`}
        fill={props.stroke}
      />
    </g>
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
  const marked = [...new Set(changeDates)].filter(
    (date) => date !== today && plotted.has(date),
  );
  const annotated = annotationLines(annotations, [...plotted], today);

  return (
    <div className="flex flex-col gap-2">
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
              shape={ChangeMarker}
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
              <SeriesLegend
                labels={data.seriesLabels}
                order={data.keywordIds}
              />
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
      {marked.length > 0 ? (
        <p className="text-caption text-muted-foreground">
          The triangle marks a day the listing changed.
        </p>
      ) : null}
    </div>
  );
}
