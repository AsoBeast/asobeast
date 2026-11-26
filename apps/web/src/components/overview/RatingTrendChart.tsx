"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  formatDayMonthInLocale,
  formatFixedNumberInLocale,
  formatRatingInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, type RatingsRange } from "@/lib/ranges";
import { ratedPoints, ratingAxis, type RatedPoint } from "./rating-trend";

const HEIGHT = CHART_HEIGHT.tall;

const PRECISE_DIGITS = 2;

function RatingTooltip({
  active,
  label,
  points,
}: {
  active?: boolean;
  label?: string | number;
  points: RatedPoint[];
}) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  if (!active || label === undefined) return null;
  const point = points.find((candidate) => candidate.date === label);
  if (!point) return null;
  return (
    <SeriesTooltip
      title={formatDayMonthInLocale(point.date, locale)}
      items={[
        {
          key: "ratingAvg",
          index: 0,
          color: "var(--color-ratingAvg)",
          label: t("charts.averageRating"),
          value: formatFixedNumberInLocale(
            point.ratingAvg,
            PRECISE_DIGITS,
            locale,
          ),
          sortBy: 0,
        },
      ]}
      footer={
        point.ratingCount === null ? null : (
          <p className="text-muted-foreground">
            {t("metrics.ratingCount", { count: point.ratingCount })}
          </p>
        )
      }
    />
  );
}

export function RatingTrendChart({
  id,
  range,
}: {
  id: string;
  range: RatingsRange;
}) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const chartConfig = {
    ratingAvg: { label: t("charts.averageRating"), color: seriesColor(0) },
  } satisfies ChartConfig;
  const points = ratedPoints(data.points);

  const state = trendState(points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={HEIGHT}
        title={t("charts.noRatingTitle")}
        body={t("charts.noRatingBody")}
      />
    );
  }
  if (state === "insufficient") {
    return (
      <ChartStat
        height={HEIGHT}
        label={t("charts.latestAverageRating")}
        value={formatRatingInLocale(
          points[points.length - 1].ratingAvg,
          locale,
        )}
        note={t("charts.trendNeedsSnapshots")}
      />
    );
  }

  const axis = ratingAxis(points);

  return (
    <ChartContainer
      config={chartConfig}
      className={`${HEIGHT} w-full`}
      role="region"
      aria-label={t("charts.ratingOverTime")}
    >
      <LineChart accessibilityLayer data={points} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          domain={axis.domain}
          ticks={axis.ticks}
          interval={0}
          tickFormatter={(value: number) => formatRatingInLocale(value, locale)}
        />
        <ChartTooltip content={<RatingTooltip points={points} />} />
        <Line
          {...LINE_PROPS}
          dataKey="ratingAvg"
          stroke="var(--color-ratingAvg)"
        />
      </LineChart>
    </ChartContainer>
  );
}
