"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { portfolioInsightsOptions } from "@/lib/queries";
import {
  appsThatMoved,
  hasWeekOfHistory,
  movementSentence,
} from "./movement-sentence";

import { LEDE } from "./skeletons";

export function DashboardLede() {
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const sentence = movementSentence(
    insights.totals.movement,
    appsThatMoved(insights),
    hasWeekOfHistory(insights),
  );
  return <p className={LEDE}>{sentence}</p>;
}
