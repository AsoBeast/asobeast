"use client";

import { Suspense, useDeferredValue } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { AppAnnotationItem, VisibilityPoint } from "@asobeast/shared";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import { AnnotationTooltipNotes } from "@/components/annotations/AnnotationTooltipNotes";
import {
  annotationLines,
  annotationsInScope,
  annotationsOn,
} from "@/components/annotations/annotation-lines";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RangePicker } from "@/components/rankings/RangePicker";
import {
  ChartNotice,
  ChartSkeleton,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { annotationsOptions, visibilityOptions } from "@/lib/queries";
import { todayUtc } from "@/lib/ranges";
import {
  presetToRange,
  VISIBILITY_RANGES,
  type VisibilityRange,
} from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";

const chartConfig = {
  visibility: { label: "Visibility", color: seriesColor(0) },
} satisfies ChartConfig;

function VisibilityTooltip({
  active,
  label,
  points,
  annotations,
}: {
  active?: boolean;
  label?: string | number;
  points: VisibilityPoint[];
  annotations: AppAnnotationItem[];
}) {
  if (!active || label === undefined) return null;

  const point = points.find((candidate) => candidate.date === label);
  if (!point) return null;

  return (
    <SeriesTooltip
      title={formatDayMonth(String(label))}
      items={[
        {
          key: "visibility",
          index: 0,
          color: "var(--color-visibility)",
          label: "Visibility",
          value: formatNumber(point.visibility),
          sortBy: point.visibility,
        },
      ]}
      footer={
        <AnnotationTooltipNotes
          annotations={annotationsOn(annotations, String(label))}
        />
      }
    />
  );
}

function VisibilityChartBody({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { country } = useKeywordScope(id);
  const { data } = useSuspenseQuery(
    visibilityOptions(id, presetToRange(range), country),
  );
  const { data: annotations } = useQuery(annotationsOptions(id));
  const inScope = annotationsInScope(annotations?.annotations ?? [], country);
  const marked = annotationLines(
    inScope,
    data.points.map((point) => point.date),
    todayUtc(),
  );

  const state = trendState(data.points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title="No visibility recorded yet"
        body="The daily pipeline captures your first point within 24 hours."
      />
    );
  }
  if (state === "insufficient") {
    const latest = data.points[data.points.length - 1];
    return (
      <ChartStat
        height={CHART_HEIGHT.compact}
        label="Latest visibility"
        value={String(latest.visibility)}
        note="A trend line needs a few more daily checks."
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label="Search visibility over time"
    >
      <AreaChart accessibilityLayer data={data.points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} />
        {marked.map((annotation) => (
          <ReferenceLine
            key={annotation.id}
            x={annotation.date}
            stroke="var(--info)"
            strokeDasharray="6 3"
          />
        ))}
        <ChartTooltip
          content={
            <VisibilityTooltip points={data.points} annotations={inScope} />
          }
        />
        <Area
          dataKey="visibility"
          type="monotone"
          stroke="var(--color-visibility)"
          fill="var(--color-visibility)"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function VisibilityChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", visibilityRangeParser);
  const shownRange = useDeferredValue(range);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Visibility history</CardDescription>
        <CardTitle>Search visibility over time</CardTitle>
        <CardAction>
          <RangePicker
            presets={VISIBILITY_RANGES}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.compact} />}>
          <VisibilityChartBody id={id} range={shownRange} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
