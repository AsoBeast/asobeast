"use client";

import { Suspense, useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { RatingTrendChart } from "@/components/overview/RatingTrendChart";
import {
  RATING_CHANGE_DAYS,
  ratedPoints,
  ratingChange,
} from "@/components/overview/rating-trend";
import { RangePicker } from "@/components/rankings/RangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import {
  MetricStrip,
  MetricStripSkeleton,
  StatTile,
} from "@/components/ui/stat-tile";
import {
  formatDayMonthInLocale,
  formatNumberInLocale,
  formatRating,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, RATINGS_RANGES, type RatingsRange } from "@/lib/ranges";
import {
  ratingsRangeParser,
  ratingsViewParser,
  type RatingsView,
} from "@/lib/search-params";
import { NewRatingsChart } from "./NewRatingsChart";
import {
  latestRatingCount,
  ratingsAdded,
  ratingsGrowth,
  type RatingsGrowth,
} from "./ratings-volume";

const RATING_CHANGE_DIGITS = 2;
const CHANGE_LABEL = `${RATING_CHANGE_DAYS}d`;

function growthNote(
  { added, since }: RatingsGrowth,
  t: MessageTranslator,
  locale: Locale,
): string {
  const day = formatDayMonthInLocale(since, locale);
  return added < 0
    ? t("ratings.fewerSince", {
        count: formatNumberInLocale(-added, locale),
        date: day,
      })
    : t("ratings.newSince", {
        count: formatNumberInLocale(added, locale),
        date: day,
      });
}

function RatingsStrip({
  id,
  range,
  view,
  onSelect,
}: {
  id: string;
  range: RatingsRange;
  view: RatingsView;
  onSelect: (next: RatingsView) => void;
}) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const average = ratedPoints(data.points).at(-1)?.ratingAvg ?? null;
  const count = latestRatingCount(data.points);
  const change = ratingChange(data.points, RATING_CHANGE_DAYS);
  const added = ratingsAdded(data.points, RATING_CHANGE_DAYS);
  const growth = ratingsGrowth(data.points);

  return (
    <MetricStrip columns={2} framed={false} label={t("ratings.figures")}>
      <StatTile
        label={t("ratings.rating")}
        value={average === null ? "—" : formatRating(average)}
        delta={
          change === null ? null : (
            <TrendChip
              label={CHANGE_LABEL}
              value={change}
              digits={RATING_CHANGE_DIGITS}
              form="pill"
            />
          )
        }
        note={
          count === null
            ? t("ratings.noRatings")
            : t("ratings.averageOf", { count })
        }
        selected={view === "average"}
        onSelect={() => onSelect("average")}
      />
      <StatTile
        label={t("ratings.ratings")}
        value={count === null ? "—" : formatNumberInLocale(count, locale)}
        delta={
          added === null ? null : (
            <TrendChip label={CHANGE_LABEL} value={added} form="pill" />
          )
        }
        note={growth === null ? "" : growthNote(growth, t, locale)}
        selected={view === "volume"}
        onSelect={() => onSelect("volume")}
      />
    </MetricStrip>
  );
}

export function RatingsPanel({ id }: { id: string }) {
  const t = useTranslations("reviews");
  const [view, setView] = useQueryState("ratingsView", ratingsViewParser);
  const [range, setRange] = useQueryState("range", ratingsRangeParser);
  const shownRange = useDeferredValue(range);

  return (
    <Card className="gap-0 py-0">
      <Suspense fallback={<MetricStripSkeleton columns={2} framed={false} />}>
        <RatingsStrip
          id={id}
          range={shownRange}
          view={view}
          onSelect={(next) => void setView(next)}
        />
      </Suspense>
      <CardContent
        aria-busy={shownRange !== range || undefined}
        className="flex flex-col gap-2 border-t border-border pt-3 pb-4"
      >
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-label font-medium text-muted-foreground">
            {t(
              view === "average" ? "ratings.averageTitle" : "ratings.newTitle",
            )}
          </h2>
          <RangePicker
            presets={RATINGS_RANGES}
            value={range}
            onChange={setRange}
          />
        </div>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.tall} />}>
          {view === "volume" ? (
            <NewRatingsChart id={id} range={shownRange} />
          ) : (
            <RatingTrendChart id={id} range={shownRange} />
          )}
        </Suspense>
      </CardContent>
    </Card>
  );
}
