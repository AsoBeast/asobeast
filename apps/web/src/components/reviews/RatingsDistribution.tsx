"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { RATING_STARS, type RatingCounts } from "@asobeast/shared";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { LIST_HEAD, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDayMonth, formatNumber, pluralize } from "@/lib/format";
import { ratingsHistogramOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { BREAKDOWN_STATIC_ROW, BreakdownBar } from "./breakdown";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_4.5rem_3.5rem] gap-3 px-2";
const LOW_STARS = ["1", "2"] as const;
const STARS_HIGH_TO_LOW = [...RATING_STARS].reverse();

const percent = (count: number, total: number): string =>
  `${(total === 0 ? 0 : (count / total) * 100).toFixed(1)}%`;

function distributionNote(
  counts: RatingCounts,
  total: number,
  capturedAt: string | null,
): string {
  const low = LOW_STARS.reduce((sum, star) => sum + counts[star], 0);
  return [
    pluralize(total, "rating"),
    capturedAt ? `read ${formatDayMonth(capturedAt)}` : null,
    total > 0 ? `${percent(low, total)} at two stars or less` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function DistributionRows({
  counts,
  total,
}: {
  counts: RatingCounts;
  total: number;
}) {
  const largest = Math.max(...STARS_HIGH_TO_LOW.map((star) => counts[star]));
  return (
    <CardContent className="flex flex-col gap-1 px-2">
      <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
        <span>Stars</span>
        <span className="text-right">Ratings</span>
        <span className="text-right">Share</span>
      </div>
      <ul className="flex list-none flex-col p-0">
        {STARS_HIGH_TO_LOW.map((star) => (
          <li key={star} className={cn(COLUMNS, BREAKDOWN_STATIC_ROW)}>
            <BreakdownBar share={largest === 0 ? 0 : counts[star] / largest} />
            <span className="relative font-medium whitespace-nowrap">
              {`${star} star`}
            </span>
            <span className="numeric relative text-right">
              {formatNumber(counts[star])}
            </span>
            <span className="numeric relative text-right text-muted-foreground">
              {percent(counts[star], total)}
            </span>
          </li>
        ))}
      </ul>
    </CardContent>
  );
}

export function RatingsDistribution({ id }: { id: string }) {
  const headingId = useId();
  const histogram = useQuery(ratingsHistogramOptions(id));
  const { data } = histogram;
  const failed = failedRead(histogram);
  const counts = data?.available ? data.counts : null;
  const total = data?.total ?? null;

  if (!failed && (counts === null || total === null)) return null;

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Ratings distribution</h2>
          </CardTitle>
        </CardHeader>
        {counts === null || total === null ? (
          <CardContent>
            <InlineQueryError
              message="Could not load the ratings distribution."
              read={histogram}
            />
          </CardContent>
        ) : (
          <>
            <DistributionRows counts={counts} total={total} />
            <CardFooter>
              <span>
                {distributionNote(counts, total, data?.capturedAt ?? null)}
              </span>
            </CardFooter>
          </>
        )}
      </Card>
    </section>
  );
}
