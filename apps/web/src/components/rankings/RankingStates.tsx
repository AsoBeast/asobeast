"use client";

import Link from "next/link";
import { formatRankPosition } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { cn } from "@/lib/utils";
import type { RankingChartData } from "./pivot";

function Frame({
  title,
  body,
  action,
  children,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 text-center",
        CHART_HEIGHT.hero,
      )}
    >
      <p className="text-body font-medium">{title}</p>
      <p className="max-w-md text-caption text-muted-foreground">{body}</p>
      {children}
      {action}
    </div>
  );
}

export function NoKeywordsTracked({ id }: { id: string }) {
  return (
    <Frame
      title="No keywords tracked yet"
      body="Ranking history is drawn from the keywords you track for this app."
      action={
        <Button asChild size="sm">
          <Link href={`/apps/${id}/keywords`}>Go to keywords</Link>
        </Button>
      }
    />
  );
}

export function NoPositionsYet() {
  return (
    <Frame
      title="No positions captured yet"
      body="The daily pipeline checks each tracked keyword and the first points appear within 24 hours of import."
    />
  );
}

export function NoDataInRange({ onWiden }: { onWiden?: () => void }) {
  return (
    <Frame
      title="Nothing captured in this range"
      body="These keywords have history outside the selected window."
      action={
        onWiden ? (
          <Button size="sm" variant="outline" onClick={onWiden}>
            Widen to 90 days
          </Button>
        ) : null
      }
    />
  );
}

export function InsufficientHistory({ data }: { data: RankingChartData }) {
  const lastIndex = data.rows.length - 1;
  const row = data.rows[lastIndex];
  const depths = data.depths[lastIndex];

  return (
    <Frame
      title="Not enough history for a trend"
      body="A line needs at least four daily checks. These are the latest captured positions."
    >
      <dl className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {data.keywordIds.map((keywordId) => {
          const value = row?.[keywordId];
          return (
            <div key={keywordId} className="flex flex-col items-center">
              <dt className="max-w-40 truncate text-caption text-muted-foreground">
                {data.seriesLabels[keywordId] ?? keywordId}
              </dt>
              <dd className="numeric font-mono text-title">
                {formatRankPosition(
                  typeof value === "number" ? value : null,
                  depths?.[keywordId] ?? undefined,
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Frame>
  );
}
