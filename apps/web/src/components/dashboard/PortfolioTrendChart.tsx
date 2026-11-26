"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartKey, type ChartKeyItem } from "@/components/charts/ChartKey";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import { SeriesFade, useFadeId } from "@/components/charts/SeriesFade";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  CHANGE_MARKER_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  COUNT_LINE_PROPS,
  GRID_PROPS,
  LINE_PROPS,
  PENDING_DOT_PROPS,
  PENDING_LINE_PROPS,
  PREVIOUS_LINE_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { formatDayMonthInLocale, formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { dayBefore } from "@/lib/utc-day";
import type { HistoryTrend } from "./history-trend";

const SERIES = seriesColor(0);
const PREVIOUS = PREVIOUS_LINE_PROPS.stroke;

export interface TrendSubject {
  label: string;
  region: string;
  counted: boolean;
}

export type DayNoter = (date: string) => ReactNode;

export const listingChangeKey = (
  t: ReturnType<typeof useTranslations>,
): ChartKeyItem => ({
  label: t("charts.listingChange"),
  color: CHANGE_MARKER_PROPS.stroke,
  mark: "dash",
});

const figure = (
  value: number,
  locale: ReturnType<typeof useAppLocale>,
): string => formatNumberInLocale(Math.round(value), locale);

function trendNote(
  unfinished: boolean,
  unchecked: boolean,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (unfinished) return t("charts.todayChecks");
  return unchecked ? t("charts.notChecked") : null;
}

function TrendTooltip({
  active,
  label,
  trend,
  subject,
  notes,
}: {
  active?: boolean;
  label?: string | number;
  trend: HistoryTrend;
  subject: TrendSubject;
  notes: DayNoter;
}) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  if (!active || label === undefined) return null;
  const day = String(label);
  const row = trend.rows.find((candidate) => candidate.date === day);
  if (!row) return null;
  const unfinished = day === trend.pendingDay;
  const value = unfinished ? row.pending : row.value;
  const note = trendNote(
    unfinished,
    value === null && row.previous === null,
    t,
  );
  return (
    <SeriesTooltip
      title={formatDayMonthInLocale(day, locale)}
      items={[
        ...(value === null
          ? []
          : [
              {
                key: "value",
                index: 0,
                color: SERIES,
                label: unfinished
                  ? t("charts.soFar", { label: subject.label })
                  : subject.label,
                value: figure(value, locale),
                sortBy: 0,
              },
            ]),
        ...(row.previous === null
          ? []
          : [
              {
                key: "previous",
                index: 0,
                color: PREVIOUS,
                label: formatDayMonthInLocale(
                  dayBefore(day, trend.days),
                  locale,
                ),
                value: figure(row.previous, locale),
                sortBy: 1,
              },
            ]),
      ]}
      footer={
        <>
          {note === null ? null : (
            <span className="text-muted-foreground">{note}</span>
          )}
          {notes(day)}
        </>
      }
    />
  );
}

export function TrendLegend({
  trend,
  marked,
}: {
  trend: HistoryTrend;
  marked: boolean;
}) {
  const t = useTranslations("dashboard");
  const items: ChartKeyItem[] =
    trend.checked === 0
      ? []
      : [
          {
            label: t("charts.lastDays", { days: trend.days }),
            color: SERIES,
            mark: "line",
          },
          ...(trend.pendingDay === null
            ? []
            : [
                {
                  label: t("charts.stillChecking"),
                  color: SERIES,
                  mark: "dash",
                } as const,
              ]),
          ...(trend.compared
            ? [
                {
                  label: t("charts.previousDays", { days: trend.days }),
                  color: PREVIOUS,
                  mark: "line",
                } as const,
              ]
            : []),
          ...(marked ? [listingChangeKey(t)] : []),
        ];
  return <ChartKey label={t("charts.chartLines")} items={items} />;
}

const NO_NOTES: DayNoter = () => null;

export function PortfolioTrendChart({
  trend,
  subject,
  markers = [],
  notes = NO_NOTES,
}: {
  trend: HistoryTrend;
  subject: TrendSubject;
  markers?: readonly string[];
  notes?: DayNoter;
}) {
  const t = useTranslations("dashboard");
  const fadeId = useFadeId();
  const height = CHART_HEIGHT.tall;

  const state = trendState(trend.checked);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={height}
        title={
          state === "empty"
            ? t("charts.nothingRecorded")
            : t("charts.notEnoughHistory")
        }
        body={t("charts.trendAppears")}
      />
    );
  }

  const config: ChartConfig = {
    value: { label: t("charts.lastDays", { days: trend.days }), color: SERIES },
    pending: { label: t("charts.stillChecking"), color: SERIES },
    previous: {
      label: t("charts.previousDays", { days: trend.days }),
      color: PREVIOUS,
    },
  };
  const line = subject.counted ? COUNT_LINE_PROPS : LINE_PROPS;
  const pendingRow = trend.rows.find((row) => row.date === trend.pendingDay);

  return (
    <ChartContainer
      config={config}
      className={`${height} w-full`}
      role="region"
      aria-label={subject.region}
    >
      <ComposedChart accessibilityLayer data={trend.rows} margin={CHART_MARGIN}>
        <SeriesFade id={fadeId} color={SERIES} />
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} ticks={trend.dayTicks} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          domain={trend.domain}
          ticks={trend.valueTicks}
          allowDecimals={false}
        />
        {markers.map((day) => (
          <ReferenceLine key={day} x={day} {...CHANGE_MARKER_PROPS} />
        ))}
        <ChartTooltip
          content={
            <TrendTooltip trend={trend} subject={subject} notes={notes} />
          }
        />
        {trend.compared ? (
          <Line {...PREVIOUS_LINE_PROPS} type={line.type} dataKey="previous" />
        ) : null}
        <Area
          {...line}
          dataKey="value"
          stroke={SERIES}
          fill={`url(#${fadeId})`}
        />
        {pendingRow === undefined || pendingRow.pending === null ? null : (
          <>
            <Line
              {...PENDING_LINE_PROPS}
              type={line.type}
              dataKey="pending"
              connectNulls
              stroke={SERIES}
              strokeWidth={LINE_PROPS.strokeWidth}
            />
            <ReferenceDot
              x={pendingRow.date}
              y={pendingRow.pending}
              {...PENDING_DOT_PROPS}
              stroke={SERIES}
            />
          </>
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
