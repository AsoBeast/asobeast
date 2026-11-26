"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import {
  BAR_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCompactInLocale, formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, type RatingsRange } from "@/lib/ranges";
import { latestRatingCount, newRatings } from "./ratings-volume";

const HEIGHT = CHART_HEIGHT.tall;

export function NewRatingsChart({
  id,
  range,
}: {
  id: string;
  range: RatingsRange;
}) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  const chartConfig = {
    added: { label: t("ratings.newTitle"), color: seriesColor(0) },
  } satisfies ChartConfig;
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const bars = newRatings(data.points);
  const latest = latestRatingCount(data.points);

  if (latest === null) {
    return (
      <ChartNotice
        height={HEIGHT}
        title={t("ratings.noHistory")}
        body={t("ratings.noHistoryBody")}
      />
    );
  }
  if (trendState(bars.length) !== "ready") {
    return (
      <ChartStat
        height={HEIGHT}
        label={t("ratings.soFar")}
        value={formatNumberInLocale(latest, locale)}
        note={t("ratings.shortHistory")}
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${HEIGHT} w-full`}
      role="region"
      aria-label={t("ratings.aria")}
    >
      <BarChart accessibilityLayer data={bars} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...VALUE_AXIS_PROPS}
          allowDecimals={false}
          tickFormatter={(value: number) =>
            formatCompactInLocale(value, locale)
          }
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
        />
        <Bar {...BAR_PROPS} dataKey="added" fill="var(--color-added)" />
      </BarChart>
    </ChartContainer>
  );
}
