"use client";

import { useQuery } from "@tanstack/react-query";
import { RATING_STARS, type RatingCounts } from "@asobeast/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { ratingsHistogramOptions } from "@/lib/queries";

const percentOf = (count: number, total: number): number =>
  total === 0 ? 0 : (count / total) * 100;

function HistogramBars({
  counts,
  total,
}: {
  counts: RatingCounts;
  total: number;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {[...RATING_STARS].reverse().map((star) => {
        const count = counts[star];
        const percent = percentOf(count, total);
        return (
          <li key={star} className="flex items-center gap-3 text-sm">
            <span className="w-12 shrink-0 numeric font-mono text-muted-foreground">
              {star} star
            </span>
            <span
              role="meter"
              aria-valuenow={Math.round(percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${star} star ratings`}
              className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="w-28 shrink-0 text-right numeric font-mono text-muted-foreground">
              {formatNumber(count)} · {percent.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function RatingsHistogramCard({ id }: { id: string }) {
  const { data } = useQuery(ratingsHistogramOptions(id));

  if (!data?.available || data.counts === null || data.total === null) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>Ratings distribution</CardDescription>
        <CardTitle>
          {formatNumber(data.total)} ratings
          {data.capturedAt ? ` as of ${formatDate(data.capturedAt)}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <HistogramBars counts={data.counts} total={data.total} />
      </CardContent>
    </Card>
  );
}
