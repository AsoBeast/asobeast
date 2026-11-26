"use client";

import { Suspense, useDeferredValue, type ReactNode } from "react";
import Link from "next/link";
import type { AppDetail, CategoryRankSeriesItem } from "@asobeast/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useTranslations } from "next-intl";
import type { DefaultLegendContentProps } from "recharts";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import { RangePicker } from "@/components/rankings/RangePicker";
import type { MessageTranslator } from "@/i18n/translator";
import { formatCategoryPosition, formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { useAppLocale } from "@/lib/use-app-locale";
import { appDetailOptions, categoryRanksOptions } from "@/lib/queries";
import { presetToRange, RANGE_PRESETS, type RangePreset } from "@/lib/ranges";
import { rangeParser } from "@/lib/search-params";
import { MAX_SERIES } from "@/components/charts/pivot";
import {
  chartDepthOf,
  headlineChartHref,
  headlineSeries,
  notInChartLabel,
} from "./category-headline";
import { ChartNotice, ChartSkeleton } from "@/components/charts/ChartStates";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  seriesDash,
  RANK_AXIS_PROPS,
  TIME_AXIS_PROPS,
} from "@/components/charts/theme";

const Y_TICKS = [1, 25, 50, 100, 150, 200];

const ticksTo = (depth: number) => Y_TICKS.filter((tick) => tick <= depth);

interface CategoryChartData {
  rows: Array<Record<string, string | number | null>>;
  config: ChartConfig;
  seriesLabels: Record<string, ReactNode>;
  keys: string[];
  totalSeries: number;
  depth: number;
}

function seriesKey(item: CategoryRankSeriesItem): string {
  return `${item.collection}_${item.genre}`;
}

function CategorySeriesLabel({ item }: { item: CategoryRankSeriesItem }) {
  const t = useTranslations("overview");
  return t.rich("charts.seriesLabel", {
    genre: item.genreName,
    collection: t(`charts.collections.${item.collection}`),
    name: (chunks) => <span translate="no">{chunks}</span>,
  });
}

function CategorySeriesLegend({
  payload,
  labels,
  order,
}: DefaultLegendContentProps & {
  labels: Record<string, ReactNode>;
  order: string[];
}) {
  const t = useTranslations("ui");
  if (!payload?.length) return null;

  return (
    <ul
      aria-label={t("chartedSeries")}
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3"
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = String(item.dataKey ?? "");
          return (
            <li key={key} className="flex items-center gap-1.5">
              <svg
                aria-hidden
                width="18"
                height="8"
                viewBox="0 0 18 8"
                className="shrink-0"
              >
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={item.color}
                  strokeWidth="2"
                  strokeDasharray={seriesDash(order.indexOf(key))}
                />
              </svg>
              {labels[key] ?? key}
            </li>
          );
        })}
    </ul>
  );
}

function buildCategoryChart(all: CategoryRankSeriesItem[]): CategoryChartData {
  const series = all.slice(0, MAX_SERIES);
  const dates = new Set<string>();
  for (const item of series) {
    for (const point of item.points) dates.add(point.date);
  }
  const sortedDates = [...dates].sort();

  const config: ChartConfig = {};
  const seriesLabels: Record<string, ReactNode> = {};
  series.forEach((item, index) => {
    const label = <CategorySeriesLabel item={item} />;
    config[seriesKey(item)] = { label, color: seriesColor(index) };
    seriesLabels[seriesKey(item)] = label;
  });

  const rows = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const item of series) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[seriesKey(item)] = point ? point.position : null;
    }
    return row;
  });

  return {
    rows,
    config,
    seriesLabels,
    keys: series.map(seriesKey),
    totalSeries: all.length,
    depth: chartDepthOf(series),
  };
}

function CategoryTooltip({
  active,
  label,
  data,
  locale,
}: {
  active?: boolean;
  label?: string | number;
  data: CategoryChartData;
  locale: Locale;
}) {
  if (!active || label === undefined) return null;
  const row = data.rows.find((candidate) => candidate.date === label);
  if (!row) return null;

  const items = data.keys.map((key, index) => {
    const value = row[key];
    const position = typeof value === "number" ? value : null;
    return {
      key,
      index,
      color: data.config[key]?.color,
      label: data.config[key]?.label ?? key,
      value: formatCategoryPosition(position),
      sortBy: position ?? Infinity,
    };
  });

  return (
    <SeriesTooltip
      title={formatDayMonthInLocale(String(label), locale)}
      items={items}
    />
  );
}

function HeaderStat({
  series,
  detail,
}: {
  series: CategoryRankSeriesItem[];
  detail: AppDetail;
}) {
  const t = useTranslations("overview");
  const headline = headlineSeries(series, detail.latestSnapshot?.price ?? null);
  if (!headline) return null;
  const href = headlineChartHref(headline, detail);
  const absent = headline.current === null ? notInChartLabel(headline) : null;

  return (
    <p className="text-body">
      <Link href={href} className="link-underline">
        {absent === null ? (
          <>
            <span className="numeric text-heading font-semibold">
              {`#${headline.current}`}
            </span>{" "}
            <span className="text-muted-foreground">
              {t.rich("charts.inGenre", {
                genre: headline.genreName,
                name: (chunks) => <span translate="no">{chunks}</span>,
              })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {t.rich(absent.key, {
              ...absent.values,
              name: (chunks) => <span translate="no">{chunks}</span>,
            })}
          </span>
        )}{" "}
        <span className="text-muted-foreground">
          {t("charts.collectionChart", {
            collection: t(`charts.collections.${headline.collection}`),
          })}
        </span>
      </Link>
    </p>
  );
}

function CategoryRankBody({
  id,
  range,
  translator,
  locale,
}: {
  id: string;
  range: RangePreset;
  translator: MessageTranslator;
  locale: Locale;
}) {
  const { data } = useSuspenseQuery(
    categoryRanksOptions(id, presetToRange(range)),
  );
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));

  if (data.series.length === 0) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.tall}
        title={translator("charts.noCategoryTitle")}
        body={translator("charts.noCategoryBody")}
      />
    );
  }

  const chart = buildCategoryChart(data.series);

  return (
    <div className="flex flex-col gap-4">
      <HeaderStat series={data.series} detail={detail} />
      <ChartContainer
        config={chart.config}
        className={`${CHART_HEIGHT.tall} w-full`}
        role="region"
        aria-label={translator("charts.categoryPositionOverTime")}
      >
        <LineChart accessibilityLayer data={chart.rows} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...TIME_AXIS_PROPS} />
          <YAxis
            {...RANK_AXIS_PROPS}
            domain={[1, chart.depth]}
            ticks={ticksTo(chart.depth)}
          />
          <ChartTooltip
            content={<CategoryTooltip data={chart} locale={locale} />}
          />
          <ChartLegend
            content={
              <CategorySeriesLegend
                labels={chart.seriesLabels}
                order={chart.keys}
              />
            }
          />
          {chart.keys.map((key, index) => (
            <Line
              {...LINE_PROPS}
              key={key}
              dataKey={key}
              stroke={`var(--color-${key})`}
              strokeDasharray={seriesDash(index)}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export function CategoryRankCard({ id }: { id: string }) {
  const [range, setRange] = useQueryState("categoryRange", rangeParser);
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const shownRange = useDeferredValue(range);

  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{t("charts.categoryTitle")}</h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <RangePicker
            presets={RANGE_PRESETS}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.tall} />}>
          <CategoryRankBody
            id={id}
            range={shownRange}
            translator={t}
            locale={locale}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
