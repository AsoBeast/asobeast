"use client";

import { Fragment, Suspense, useId } from "react";
import Link from "next/link";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { VisibilityHistory } from "@asobeast/shared";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { AppIcon } from "@/components/AppIcon";
import {
  CHART_NOTICE,
  ChartNotice,
  ChartSkeleton,
  trendState,
} from "@/components/charts/ChartStates";
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
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
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
import {
  formatCountryInLocale,
  formatDayMonthInLocale,
  formatNumberInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { isVisibilityOfMarket, visibilityOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  activityLanes,
  changeLinesOn,
  changeWindowRange,
  markLabel,
  ownChangeDays,
  visibilityRows,
  windowDays,
  type Lane,
  type VisibilityRow,
} from "./change-activity";
import { effectLine, effectsByDay, type ChangeEffect } from "./change-effects";
import { ChangeActivityKey } from "./ChangeActivityKey";
import { KindMark } from "./KindMark";
import { ChangeActivitySkeleton } from "./skeletons";
import type { ShownChange } from "./timeline-days";
import {
  useChangeEvents,
  useChangeImpact,
  useImpactCountry,
} from "./use-change-view";

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
  const t = useTranslations("changes");
  const locale = useAppLocale();
  if (!active || label === undefined) return null;
  const day = String(label);
  const row = rows.find((candidate) => candidate.date === day);
  if (!row) return null;
  const changed = changeLinesOn(lanes, day, t, locale);
  const effect = effects.get(day);

  return (
    <SeriesTooltip
      title={formatDayMonthInLocale(day, locale)}
      items={
        row.visibility === null
          ? []
          : [
              {
                key: "visibility",
                index: 0,
                color: "var(--color-visibility)",
                label: t("timeline.visibility"),
                value: formatNumberInLocale(row.visibility, locale),
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
            <p className="text-muted-foreground">
              {effectLine(effect, t, locale)}
            </p>
          ) : null}
        </>
      }
    />
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
  const t = useTranslations("changes");
  const locale = useAppLocale();
  const chartConfig = {
    visibility: { label: t("timeline.visibility"), color: seriesColor(0) },
  } satisfies ChartConfig;
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
              ? t("activity.emptyTitle")
              : t("activity.shortTitle")
          }
          body={t("activity.shortBody")}
        />
        <p
          aria-hidden
          className="flex justify-between text-tick text-faint-foreground"
          style={{ paddingLeft: PLOT_LEFT, paddingRight: CHART_MARGIN.right }}
        >
          <span>{formatDayMonthInLocale(rows[0].date, locale)}</span>
          <span>
            {formatDayMonthInLocale(rows[rows.length - 1].date, locale)}
          </span>
        </p>
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(CHART_HEIGHT.compact, PLOT_COLUMN, "w-full")}
      role="region"
      aria-label={t("activity.aria")}
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

function VisibilityLine({
  read,
  span,
  lanes,
  markers,
  effects,
}: {
  read: UseQueryResult<VisibilityHistory>;
  span: string[];
  lanes: Lane[];
  markers: string[];
  effects: ReadonlyMap<string, ChangeEffect>;
}) {
  const t = useTranslations("changes");
  if (read.data) {
    return (
      <VisibilityPlot
        rows={visibilityRows(read.data.points, span)}
        lanes={lanes}
        markers={markers}
        effects={effects}
      />
    );
  }
  if (failedRead(read)) {
    return (
      <div className={cn(PLOT_COLUMN, CHART_HEIGHT.compact, CHART_NOTICE)}>
        <InlineQueryError message={t("activity.loadFailed")} read={read} />
      </div>
    );
  }
  return (
    <ChartSkeleton height={CHART_HEIGHT.compact} className={PLOT_COLUMN} />
  );
}

function LaneRow({
  lane,
  onShowChange,
}: {
  lane: Lane;
  onShowChange: (change: ShownChange) => void;
}) {
  const t = useTranslations("changes");
  const locale = useAppLocale();
  return (
    <Fragment>
      <div className="flex h-9 min-w-0 items-center gap-2 mt-1 border-border-subtle text-dense @3xl/activity:mt-0 @3xl/activity:border-t">
        <AppIcon src={lane.iconUrl} size={16} />
        <bdi className="truncate font-medium">{lane.appName}</bdi>
        {lane.own ? <Badge variant="brand">{t("you")}</Badge> : null}
        <span className="numeric ml-auto text-label text-faint-foreground">
          <span>{formatNumberInLocale(lane.count, locale)}</span>
          <span className="sr-only">{t("activity.changes")}</span>
        </span>
      </div>
      <div className="relative h-9 border-t border-border-subtle">
        {lane.marks.map((mark) => {
          const label = markLabel(lane, mark, t, locale);
          return (
            <button
              key={mark.day}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onShowChange({ appId: lane.appId, day: mark.day })}
              className="absolute inset-y-0 flex w-4 -translate-x-1/2 flex-col items-center justify-center gap-0.5 rounded-sm text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                left: `calc(${PLOT_LEFT}px + (100% - ${PLOT_INSET}px) * ${mark.position})`,
              }}
            >
              {mark.kinds.map((kind) => (
                <KindMark key={kind} kind={kind} own={lane.own} />
              ))}
            </button>
          );
        })}
      </div>
    </Fragment>
  );
}

function Activity({
  id,
  homeCountry,
  onShowChange,
}: {
  id: string;
  homeCountry: string;
  onShowChange: (change: ShownChange) => void;
}) {
  const t = useTranslations("changes");
  const locale = useAppLocale();
  const headingId = useId();
  const { events, days, homeListing, today } = useChangeEvents(id);
  const country = useImpactCountry(homeCountry);
  const span = windowDays(today, days);
  const lanes = activityLanes(events, span, t);
  const visibility = useQuery({
    ...visibilityOptions(id, changeWindowRange(today, days), country),
    enabled: lanes.length > 0,
    placeholderData: (previous, previousQuery) =>
      isVisibilityOfMarket(previousQuery?.queryKey, country)
        ? previous
        : undefined,
  });
  const impact = useChangeImpact(id, days, homeCountry);

  if (lanes.length === 0) return null;
  const effects =
    homeListing && impact
      ? effectsByDay(impact)
      : new Map<string, ChangeEffect>();

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>{t("activity.title")}</h2>
          </CardTitle>
          <CardAction>
            <VisibilityHelp />
          </CardAction>
        </CardHeader>
        <CardContent className="@container/activity flex flex-col gap-3">
          <ChangeActivityKey />
          <div className={LANES}>
            <VisibilityLine
              read={visibility}
              span={span}
              lanes={lanes}
              markers={ownChangeDays(events, span)}
              effects={effects}
            />
            {lanes.map((lane) => (
              <LaneRow
                key={lane.appId}
                lane={lane}
                onShowChange={onShowChange}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2">
          <span>
            {t("activity.footer", {
              market: formatCountryInLocale(country, locale),
            })}
          </span>
          <Link href={`/apps/${id}/rankings`} className={FOOTER_LINK}>
            {t("activity.openRankings")}
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}

export function ChangeActivity(props: {
  id: string;
  homeCountry: string;
  onShowChange: (change: ShownChange) => void;
}) {
  return (
    <Suspense fallback={<ChangeActivitySkeleton />}>
      <Activity {...props} />
    </Suspense>
  );
}
