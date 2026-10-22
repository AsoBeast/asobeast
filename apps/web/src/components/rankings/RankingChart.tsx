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
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  RANK_AXIS_PROPS,
  seriesDash,
  TIME_AXIS_PROPS,
} from "@/components/charts/theme";
import { formatDayMonth } from "@/lib/format";
import { todayUtc } from "@/lib/ranges";
import {
  loneKey,
  NOT_CHECKED,
  notFoundKey,
  type RankingChartData,
} from "./pivot";
import { RankBandLabel } from "./RankBandLabel";

const Y_TICKS = [1, 10, 25, 50, 100, 200];

const markerLineProps = (dataKey: string, keywordId: string, fill: string) => ({
  dataKey,
  type: "monotone" as const,
  stroke: "transparent",
  legendType: "none" as const,
  connectNulls: false,
  isAnimationActive: false,
  activeDot: false as const,
  dot: { r: 3, fill, stroke: `var(--color-${keywordId})`, strokeWidth: 1.5 },
});

const RANK_BANDS = [
  { from: 1, to: 3, fill: "var(--rank-band-1)", label: "Top 3" },
  { from: 3, to: 10, fill: "var(--rank-band-2)", label: "Top 10" },
  { from: 10, to: 25, fill: "var(--rank-band-3)", label: "Top 25" },
] as const;

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
}: {
  data: RankingChartData;
  changeDates?: string[];
  annotations?: AppAnnotationItem[];
}) {
  const today = todayUtc();
  const plotted = new Set(data.rows.map((row) => String(row.date)));
  const marked = changeDates.filter(
    (date) => date !== today && plotted.has(date),
  );
  const annotated = annotationLines(annotations, [...plotted], today);

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
            label={{ value: band.label, content: RankBandLabel }}
          />
        ))}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...RANK_AXIS_PROPS} domain={[1, RANK_DEPTH]} ticks={Y_TICKS} />
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
