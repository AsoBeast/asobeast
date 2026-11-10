"use client";

import { useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { PortfolioHistory, PortfolioHistoryDays } from "@asobeast/shared";
import { portfolioHistoryOptions } from "@/lib/queries";
import { dashboardRangeParser } from "@/lib/search-params";

export function useDashboardRange(): {
  days: PortfolioHistoryDays;
  waiting: boolean;
} {
  const [range] = useQueryState("range", dashboardRangeParser);
  const days = useDeferredValue(range);
  return { days, waiting: days !== range };
}

export function useRangeHistory(): {
  days: PortfolioHistoryDays;
  history: PortfolioHistory;
} {
  const { days } = useDashboardRange();
  const { data: history } = useSuspenseQuery(portfolioHistoryOptions(days));
  return { days, history };
}
