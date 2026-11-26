"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { ActionItem, ActionTrend } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  seriesDash,
  timeAxisPropsInLocale,
  timeTooltipPropsInLocale,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useAppLocale } from "@/lib/use-app-locale";
import { trendChartData } from "./action-trend-chart";

export function ActionTrendChart({
  trend,
  item,
}: {
  trend: ActionTrend;
  item: ActionItem;
}) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  const data = trendChartData(trend, item, t);
  const state = trendState(data.plotted);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.compact}
        title={state === "empty" ? t("trend.empty") : t("trend.insufficient")}
        body={data.summary}
      />
    );
  }

  const config = {
    value: { label: data.metricLabel, color: seriesColor(0) },
    notFound: { label: t("trend.notFoundWithin"), color: seriesColor(0) },
  } satisfies ChartConfig;
  const lastDate = data.rows.at(-1)?.date;

  return (
    <div>
      <ChartContainer
        config={config}
        className={`${CHART_HEIGHT.compact} w-full`}
        role="region"
        aria-label={t("trend.overTime", { metric: data.metricLabel })}
      >
        <LineChart accessibilityLayer data={data.rows} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...timeAxisPropsInLocale(locale)} />
          <YAxis
            {...VALUE_AXIS_PROPS}
            reversed={data.reversed}
            domain={data.domain}
            allowDataOverflow
          />
          {data.markers.map((marker) => (
            <ReferenceLine
              key={marker.label}
              x={marker.date}
              stroke="var(--muted-foreground)"
              strokeDasharray={seriesDash(1)}
              label={{
                value: marker.label,
                position:
                  marker.date === lastDate ? "insideTopRight" : "insideTopLeft",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
          ))}
          <ChartTooltip
            content={
              <ChartTooltipContent {...timeTooltipPropsInLocale(locale)} />
            }
          />
          <Line
            {...LINE_PROPS}
            dataKey="value"
            stroke="var(--color-value)"
            connectNulls={false}
          />
          <Line
            dataKey="notFound"
            stroke="transparent"
            legendType="none"
            connectNulls={false}
            isAnimationActive={false}
            activeDot={false}
            dot={{
              r: 3,
              fill: "var(--background)",
              stroke: "var(--color-notFound)",
              strokeWidth: 1.5,
            }}
          />
        </LineChart>
      </ChartContainer>
      <p className="sr-only">{data.summary}</p>
    </div>
  );
}
