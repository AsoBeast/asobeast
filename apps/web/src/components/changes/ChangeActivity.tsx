"use client";

import { Fragment, Suspense, useId } from "react";
import Link from "next/link";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { AppIcon } from "@/components/AppIcon";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import { SeriesFade, useFadeId } from "@/components/charts/SeriesFade";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  CHANGE_MARKER_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { FOOTER_LINK, PANEL_HEADER } from "@/components/layout/panel-classes";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { VisibilityHelp } from "@/components/visibility/VisibilityHelp";
import { formatCountry, formatDayMonth, formatNumber } from "@/lib/format";
import { changeImpactOptions, visibilityOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  activityLanes,
  changesOn,
  changeWindowRange,
  markLabel,
  ownChangeDays,
  visibilityRows,
  windowDays,
  type Lane,
  type VisibilityRow,
} from "./change-activity";
import { effectLine, effectsByDay, type ChangeEffect } from "./change-effects";
import { CHANGE_KIND_LABELS, CHANGE_KINDS } from "./change-fields";
import { KindMark } from "./KindMark";
import { ChangeActivitySkeleton } from "./skeletons";
import { useChangeEvents, useImpactCountry } from "./use-change-view";

const chartConfig = {
  visibility: { label: "Visibility", color: seriesColor(0) },
} satisfies ChartConfig;

const PLOT_LEFT = CHART_MARGIN.left + VALUE_AXIS_PROPS.width;
const PLOT_INSET = PLOT_LEFT + CHART_MARGIN.right;
const LANES =
  "grid grid-cols-1 gap-x-4 @3xl/activity:grid-cols-[11rem_minmax(0,1fr)]";
const PLOT_COLUMN = "@3xl/activity:col-start-2";

function ActivityTooltip({
  active,
  label,
  rows,
  lanes,
  effects,
}: {
  active?: boolean;
  label?: string | number;
  rows: VisibilityRow[];
  lanes: Lane[];
  effects: ReadonlyMap<string, ChangeEffect>;
}) {
  if (!active || label === undefined) return null;
  const day = String(label);
  const row = rows.find((candidate) => candidate.date === day);
  if (!row) return null;
  const changed = changesOn(lanes, day);
  const effect = effects.get(day);

  return (
    <SeriesTooltip
      title={formatDayMonth(day)}
      items={
        row.visibility === null
          ? []
          : [
              {
                key: "visibility",
                index: 0,
                color: "var(--color-visibility)",
                label: "Visibility",
                value: formatNumber(row.visibility),
                sortBy: 0,
              },
            ]
      }
      footer={
        <>
          {changed.map((line) => (
            <p key={line} className="text-muted-foreground">
              {line}
            </p>
          ))}
          {effect ? (
            <p className="text-muted-foreground">{effectLine(effect)}</p>
          ) : null}
        </>
      }
    />
  );
}

function ActivityKey() {
  return (
    <ul
      aria-label="Chart marks"
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      <li className="flex items-center gap-1.5">
        <svg aria-hidden width="16" height="8" viewBox="0 0 16 8">
          <line
            x1="0"
            y1="4"
            x2="16"
            y2="4"
            stroke={seriesColor(0)}
            strokeWidth="2"
          />
        </svg>
        <span>Visibility</span>
      </li>
      {CHANGE_KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <KindMark kind={kind} />
          <span>{CHANGE_KIND_LABELS[kind]}</span>
        </li>
      ))}
    </ul>
  );
}

function VisibilityPlot({
  rows,
  lanes,
  markers,
  effects,
}: {
  rows: VisibilityRow[];
  lanes: Lane[];
  markers: string[];
  effects: ReadonlyMap<string, ChangeEffect>;
}) {
  const fadeId = useFadeId();
  const state = trendState(
    rows.filter((row) => row.visibility !== null).length,
  );

  if (state !== "ready") {
    return (
      <div className={PLOT_COLUMN}>
        <ChartNotice
          height={CHART_HEIGHT.compact}
          title={
            state === "empty"
              ? "No visibility recorded in this window"
              : "Not enough visibility history yet"
          }
          body="The line needs four daily checks of this market's keywords."
        />
        <p
          aria-hidden
          className="flex justify-between text-tick text-faint-foreground"
          style={{ paddingLeft: PLOT_LEFT, paddingRight: CHART_MARGIN.right }}
        >
          <span>{formatDayMonth(rows[0].date)}</span>
          <span>{formatDayMonth(rows[rows.length - 1].date)}</span>
        </p>
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(CHART_HEIGHT.compact, PLOT_COLUMN, "w-full")}
      role="region"
      aria-label="Search visibility and the days your listing changed"
    >
      <ComposedChart accessibilityLayer data={rows} margin={CHART_MARGIN}>
        <SeriesFade id={fadeId} color="var(--color-visibility)" />
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} domain={["auto", "auto"]} />
        {markers.map((day) => (
          <ReferenceLine key={day} x={day} {...CHANGE_MARKER_PROPS} />
        ))}
        <ChartTooltip
          content={
            <ActivityTooltip rows={rows} lanes={lanes} effects={effects} />
          }
        />
        <Area
          {...LINE_PROPS}
          dataKey="visibility"
          stroke="var(--color-visibility)"
          fill={`url(#${fadeId})`}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

function LaneRow({
  lane,
  onShowDay,
}: {
  lane: Lane;
  onShowDay: (day: string) => void;
}) {
  return (
    <Fragment>
      <div className="flex h-9 min-w-0 items-center gap-2 mt-1 border-border-subtle text-dense @3xl/activity:mt-0 @3xl/activity:border-t">
        <AppIcon src={lane.iconUrl} size={16} />
        <bdi className="truncate font-medium">{lane.appName}</bdi>
        {lane.own ? <Badge variant="brand">You</Badge> : null}
        <span className="numeric ml-auto text-label text-faint-foreground">
          {lane.count}
        </span>
      </div>
      <div className="relative h-9 border-t border-border-subtle">
        {lane.marks.map((mark) => (
          <button
            key={mark.day}
            type="button"
            aria-label={markLabel(lane, mark)}
            title={markLabel(lane, mark)}
            onClick={() => onShowDay(mark.day)}
            className={cn(
              "absolute inset-y-0 flex w-4 -translate-x-1/2 flex-col items-center justify-center gap-0.5 rounded-sm outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
              lane.own ? "text-brand-mark" : "text-muted-foreground",
            )}
            style={{
              left: `calc(${PLOT_LEFT}px + (100% - ${PLOT_INSET}px) * ${mark.position})`,
            }}
          >
            {mark.kinds.map((kind) => (
              <KindMark key={kind} kind={kind} />
            ))}
          </button>
        ))}
      </div>
    </Fragment>
  );
}

function Activity({
  id,
  homeCountry,
  onShowDay,
}: {
  id: string;
  homeCountry: string;
  onShowDay: (day: string) => void;
}) {
  const headingId = useId();
  const { events, days, homeListing, today } = useChangeEvents(id);
  const country = useImpactCountry(homeCountry);
  const window = windowDays(today, days);
  const { data: visibility } = useSuspenseQuery(
    visibilityOptions(id, changeWindowRange(today, days), country),
  );
  const { data: impact } = useQuery(changeImpactOptions(id, days, country));

  const lanes = activityLanes(events, window);
  if (lanes.length === 0) return null;
  const rows = visibilityRows(visibility.points, window);
  const effects =
    homeListing && impact
      ? effectsByDay(impact)
      : new Map<string, ChangeEffect>();

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Visibility and listing changes</h2>
          </CardTitle>
          <CardAction>
            <VisibilityHelp />
          </CardAction>
        </CardHeader>
        <CardContent className="@container/activity flex flex-col gap-3">
          <ActivityKey />
          <div className={LANES}>
            <VisibilityPlot
              rows={rows}
              lanes={lanes}
              markers={ownChangeDays(events, window)}
              effects={effects}
            />
            {lanes.map((lane) => (
              <LaneRow key={lane.appId} lane={lane} onShowDay={onShowDay} />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2">
          <span>{`Visibility over every keyword tracked in ${formatCountry(country)}. A mark opens that day in the list below.`}</span>
          <Link href={`/apps/${id}/rankings`} className={FOOTER_LINK}>
            Open rankings
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}

export function ChangeActivity(props: {
  id: string;
  homeCountry: string;
  onShowDay: (day: string) => void;
}) {
  return (
    <Suspense fallback={<ChangeActivitySkeleton />}>
      <Activity {...props} />
    </Suspense>
  );
}
