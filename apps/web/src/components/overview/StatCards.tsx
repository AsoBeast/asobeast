"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { appSummaryOptions } from "@/lib/queries";
import { TrendChip } from "@/components/ui/delta-chip";

export function StatCards({ id }: { id: string }) {
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Visibility</CardDescription>
          <CardTitle className="numeric font-mono text-3xl">
            {Math.round(summary.visibility.current)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <TrendChip label="7d" value={summary.visibility.delta7d} />
          <TrendChip label="30d" value={summary.visibility.delta30d} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Tracked keywords</CardDescription>
          <CardTitle className="numeric font-mono text-3xl">
            {summary.trackedKeywords}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {summary.rankDistribution.top10} in top 10
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Competitors</CardDescription>
          <CardTitle className="numeric font-mono text-3xl">
            {summary.competitors}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/apps/${id}/competitors`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View comparison
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Last refresh</CardDescription>
          <CardTitle className="text-xl">
            {summary.lastRefreshAt
              ? formatDate(summary.lastRefreshAt)
              : "never"}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
