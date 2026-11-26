"use client";

import {
  SeriesTooltip,
  type SeriesTooltipItem,
} from "@/components/charts/SeriesTooltip";
import { seriesColor } from "@/components/charts/theme";
import type { ChartConfig } from "@/components/ui/chart";
import { formatDayMonth, pluralize } from "@/lib/format";
import type { RatingRow } from "./rating-trend";

const PRECISE_DIGITS = 2;

export const RATING_SERIES_LABELS = {
  ratingAvg: "Average rating",
  newAverage: "New ratings, 7 day average",
};

type SeriesKey = keyof typeof RATING_SERIES_LABELS;

export const RATING_SERIES_ORDER: SeriesKey[] = ["ratingAvg", "newAverage"];

export const RATING_CHART_CONFIG = {
  ratingAvg: { label: RATING_SERIES_LABELS.ratingAvg, color: seriesColor(0) },
  newAverage: { label: RATING_SERIES_LABELS.newAverage, color: seriesColor(1) },
} satisfies ChartConfig;

function tooltipItem(key: SeriesKey, value: number): SeriesTooltipItem {
  const index = RATING_SERIES_ORDER.indexOf(key);
  return {
    key,
    index,
    color: `var(--color-${key})`,
    label: RATING_SERIES_LABELS[key],
    value: value.toFixed(PRECISE_DIGITS),
    sortBy: index,
  };
}

export function RatingTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string | number;
  rows: RatingRow[];
}) {
  if (!active || label === undefined) return null;
  const row = rows.find((candidate) => candidate.date === label);
  if (!row) return null;
  return (
    <SeriesTooltip
      title={formatDayMonth(row.date)}
      items={[
        tooltipItem("ratingAvg", row.ratingAvg),
        ...(row.newAverage === null
          ? []
          : [tooltipItem("newAverage", row.newAverage)]),
      ]}
      footer={
        row.ratingCount === null ? null : (
          <p className="text-muted-foreground">
            {pluralize(row.ratingCount, "rating")}
          </p>
        )
      }
    />
  );
}
