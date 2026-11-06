"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { portfolioInsightsOptions } from "@/lib/queries";
import {
  appsThatMoved,
  hasWeekOfHistory,
  movementSentence,
} from "./movement-sentence";

const LEDE = "max-w-[70ch] text-body text-foreground";

export function DashboardLede() {
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const sentence = movementSentence(
    insights.totals.movement,
    appsThatMoved(insights),
    hasWeekOfHistory(insights),
  );
  return <p className={LEDE}>{sentence}</p>;
}

export function DashboardLedeSkeleton() {
  return (
    <div aria-hidden className={LEDE}>
      <Skeleton
        shape="text"
        className="inline-block w-80 max-w-full align-middle"
      />
    </div>
  );
}
