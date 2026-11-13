"use client";

import { Suspense, useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
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
  formatDayMonth,
  formatNumber,
  formatRating,
  pluralize,
} from "@/lib/format";
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

const CHART_TITLES: Record<RatingsView, string> = {
  average: "Average rating",
  volume: "New ratings",
};

function growthNote({ added, since }: RatingsGrowth): string {
  const day = formatDayMonth(since);
  return added < 0
    ? `${formatNumber(-added)} fewer since ${day}`
    : `${formatNumber(added)} new since ${day}`;
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
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const average = ratedPoints(data.points).at(-1)?.ratingAvg ?? null;
  const count = latestRatingCount(data.points);
  const change = ratingChange(data.points, RATING_CHANGE_DAYS);
  const added = ratingsAdded(data.points, RATING_CHANGE_DAYS);
  const growth = ratingsGrowth(data.points);

  return (
    <MetricStrip columns={2} framed={false} label="Ratings figures">
      <StatTile
        label="Rating"
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
            ? "No ratings read yet"
            : `Average of ${pluralize(count, "rating")}`
        }
        selected={view === "average"}
        onSelect={() => onSelect("average")}
      />
      <StatTile
        label="Ratings"
        value={count === null ? "—" : formatNumber(count)}
        delta={
          added === null ? null : (
            <TrendChip label={CHANGE_LABEL} value={added} form="pill" />
          )
        }
        note={growth === null ? "" : growthNote(growth)}
        selected={view === "volume"}
        onSelect={() => onSelect("volume")}
      />
    </MetricStrip>
  );
}

export function RatingsPanel({ id }: { id: string }) {
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
            {CHART_TITLES[view]}
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
