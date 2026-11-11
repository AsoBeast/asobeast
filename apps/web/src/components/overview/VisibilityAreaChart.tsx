"use client";

import Link from "next/link";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { AppAnnotationItem, ChangeField } from "@asobeast/shared";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { ChartKey, type ChartKeyItem } from "@/components/charts/ChartKey";
import { SeriesFade, useFadeId } from "@/components/charts/SeriesFade";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import { AnnotationTooltipNotes } from "@/components/annotations/AnnotationTooltipNotes";
import {
  annotationLines,
  annotationsInScope,
  annotationsOn,
} from "@/components/annotations/annotation-lines";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  CHANGE_MARKER_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  PREVIOUS_LINE_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  changedFieldsLabel,
  listingChangeDays,
} from "@/components/keywords/position-history";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { formatDayMonth, formatNumber } from "@/lib/format";
import {
  annotationsOptions,
  appDetailOptions,
  changesOptions,
  visibilityOptions,
} from "@/lib/queries";
import {
  presetDays,
  presetToRange,
  todayUtc,
  type VisibilityRange,
} from "@/lib/ranges";
import { dayBefore } from "@/lib/utc-day";
import {
  previousRange,
  withPrevious,
  type VisibilityRow,
} from "./visibility-rows";

const chartConfig = {
  visibility: { label: "Visibility", color: seriesColor(0) },
} satisfies ChartConfig;

function VisibilityTooltip({
  active,
  label,
  rows,
  days,
  changes,
  annotations,
}: {
  active?: boolean;
  label?: string | number;
  rows: VisibilityRow[];
  days: number;
  changes: ReadonlyMap<string, ChangeField[]>;
  annotations: AppAnnotationItem[];
}) {
  if (!active || label === undefined) return null;

  const day = String(label);
  const row = rows.find((candidate) => candidate.date === day);
  if (!row) return null;
  const changed = changes.get(day);

  return (
    <SeriesTooltip
      title={formatDayMonth(day)}
      items={[
        {
          key: "visibility",
          index: 0,
          color: "var(--color-visibility)",
          label: "Visibility",
          value: formatNumber(row.visibility),
          sortBy: 0,
        },
        ...(row.previous === null
          ? []
          : [
              {
                key: "previous",
                index: 0,
                color: PREVIOUS_LINE_PROPS.stroke,
                label: formatDayMonth(dayBefore(day, days)),
                value: formatNumber(row.previous),
                sortBy: 1,
              },
            ]),
      ]}
      footer={
        <>
          {changed ? (
            <p className="text-muted-foreground">
              {`${changedFieldsLabel(changed)} changed`}
            </p>
          ) : null}
          <AnnotationTooltipNotes
            annotations={annotationsOn(annotations, day)}
          />
        </>
      }
    />
  );
}

function chartKey(
  days: number,
  compared: boolean,
  changed: boolean,
): ChartKeyItem[] {
  return [
    ...(compared
      ? [
          {
            label: `Last ${days} days`,
            color: seriesColor(0),
            mark: "line",
          } as const,
          {
            label: `Previous ${days} days`,
            color: PREVIOUS_LINE_PROPS.stroke,
            mark: "line",
          } as const,
        ]
      : []),
    ...(changed
      ? [
          {
            label: "Listing change",
            color: CHANGE_MARKER_PROPS.stroke,
            mark: "dash",
          } as const,
        ]
      : []),
  ];
}

export function VisibilityAreaChart({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const fadeId = useFadeId();
  const { country } = useKeywordScope(id);
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const bounds = presetToRange(range);
  const days = presetDays(range);
  const { data } = useSuspenseQuery(visibilityOptions(id, bounds, country));
  const { data: earlier } = useQuery(
    visibilityOptions(id, previousRange(bounds, days), country),
  );
  const { data: timeline } = useQuery(changesOptions(id, days, country));
  const { data: annotations } = useQuery(annotationsOptions(id));

  const rows = withPrevious(data.points, earlier?.points ?? [], days);
  const plotted = new Set(rows.map((row) => row.date));
  const inScope = annotationsInScope(annotations?.annotations ?? [], country);
  const marked = annotationLines(inScope, [...plotted], todayUtc());
  const changes = listingChangeDays(timeline?.events ?? [], {
    country: country ?? app.country,
    homeCountry: app.country,
  });
  const changeDays = [...changes.keys()].filter((day) => plotted.has(day));
  const compared = rows.some((row) => row.previous !== null);

  const state = trendState(rows.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.tall}
        title="No visibility recorded yet"
        body="The daily pipeline captures your first point within 24 hours."
      />
    );
  }
  if (state === "insufficient") {
    const latest = rows[rows.length - 1];
    return (
      <ChartStat
        height={CHART_HEIGHT.tall}
        label="Latest visibility"
        value={String(latest.visibility)}
        note="A trend line needs a few more daily checks."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer
        config={chartConfig}
        className={`${CHART_HEIGHT.tall} w-full`}
        role="region"
        aria-label="Search visibility over time"
      >
        <ComposedChart accessibilityLayer data={rows} margin={CHART_MARGIN}>
          <SeriesFade id={fadeId} color="var(--color-visibility)" />
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...TIME_AXIS_PROPS} />
          <YAxis {...VALUE_AXIS_PROPS} />
          {changeDays.map((day) => (
            <ReferenceLine key={day} x={day} {...CHANGE_MARKER_PROPS} />
          ))}
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
              <VisibilityTooltip
                rows={rows}
                days={days}
                changes={changes}
                annotations={inScope}
              />
            }
          />
          {compared ? (
            <Line {...PREVIOUS_LINE_PROPS} dataKey="previous" connectNulls />
          ) : null}
          <Area
            {...LINE_PROPS}
            dataKey="visibility"
            stroke="var(--color-visibility)"
            fill={`url(#${fadeId})`}
          />
        </ComposedChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-label text-muted-foreground empty:hidden">
        <ChartKey
          label="Chart lines"
          items={chartKey(days, compared, changeDays.length > 0)}
        />
        {changeDays.length > 0 ? (
          <Link href={`/apps/${id}/changes`} className={FOOTER_LINK}>
            See what each change did
          </Link>
        ) : null}
      </div>
    </div>
  );
}
