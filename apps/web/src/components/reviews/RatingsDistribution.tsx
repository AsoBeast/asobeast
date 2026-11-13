"use client";

import { useId } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RATING_STARS, type RatingsHistogram } from "@asobeast/shared";
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
  counts: NonNullable<RatingsHistogram["counts"]>,
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

export function RatingsDistribution({ id }: { id: string }) {
  const headingId = useId();
  const { data } = useSuspenseQuery(ratingsHistogramOptions(id));
  const { counts, total } = data;

  if (!data.available || counts === null || total === null) return null;
  const largest = Math.max(...STARS_HIGH_TO_LOW.map((star) => counts[star]));

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Ratings distribution</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-2">
          <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
            <span>Stars</span>
            <span className="text-right">Ratings</span>
            <span className="text-right">Share</span>
          </div>
          <ul className="flex list-none flex-col p-0">
            {STARS_HIGH_TO_LOW.map((star) => (
              <li key={star} className={cn(COLUMNS, BREAKDOWN_STATIC_ROW)}>
                <BreakdownBar
                  share={largest === 0 ? 0 : counts[star] / largest}
                />
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
        <CardFooter>
          <span>{distributionNote(counts, total, data.capturedAt)}</span>
        </CardFooter>
      </Card>
    </section>
  );
}
