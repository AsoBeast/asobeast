"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { AppSummary } from "@asobeast/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { discoveriesHref, discoveriesLine } from "@/lib/keyword-discoveries";
import { appSummaryOptions } from "@/lib/queries";
import { TrendChip } from "@/components/ui/delta-chip";
import { VisibilityHelp } from "@/components/visibility/VisibilityHelp";
import { ShareOfVoiceLine } from "./ShareOfVoiceLine";

export function StatCards({ id }: { id: string }) {
  const { country, switchable } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const label = switchable
    ? ` · ${country?.toUpperCase() ?? "All markets"}`
    : "";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1">
            <span>{`Visibility${label}`}</span>
            <VisibilityHelp />
          </CardDescription>
          <CardTitle className="numeric font-mono text-3xl">
            {Math.round(summary.visibility.current)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-3">
            <TrendChip label="7d" value={summary.visibility.delta7d} />
            <TrendChip label="30d" value={summary.visibility.delta30d} />
          </div>
          <ShareOfVoiceLine summary={summary} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>{`Tracked keywords${label}`}</CardDescription>
          <CardTitle className="numeric font-mono text-3xl">
            {summary.trackedKeywords}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{`${summary.rankDistribution.top10} in top 10`}</span>
          <DiscoveriesLink id={id} country={country} summary={summary} />
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
            className="text-xs font-medium text-muted-foreground hover:text-foreground print:hidden"
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

function DiscoveriesLink({
  id,
  country,
  summary,
}: {
  id: string;
  country: string | undefined;
  summary: AppSummary;
}) {
  const line = discoveriesLine(summary.discoveries);
  if (line === null) return null;
  return (
    <Link
      href={discoveriesHref(id, country)}
      className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2 print:hidden"
    >
      {line}
    </Link>
  );
}
