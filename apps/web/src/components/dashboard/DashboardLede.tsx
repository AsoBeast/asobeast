"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";
import { movementSentence } from "./movement-sentence";

const LEDE = "max-w-[70ch] text-body text-foreground";

export function DashboardLede() {
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const sentence = movementSentence(
    insights.totals.movement,
    portfolio.totals.apps,
    insights.apps.some((app) => app.top10Delta7d !== null),
  );
  return <p className={LEDE}>{sentence}</p>;
}

export function DashboardLedeSkeleton() {
  return (
    <p aria-hidden className={LEDE}>
      <Skeleton
        shape="text"
        className="inline-block w-80 max-w-full align-middle"
      />
    </p>
  );
}
