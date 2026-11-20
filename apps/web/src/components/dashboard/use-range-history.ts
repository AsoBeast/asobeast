"use client";

import { useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState, useQueryStates } from "nuqs";
import type {
  PortfolioHistory,
  PortfolioHistoryDays,
  PortfolioHistoryScope,
} from "@asobeast/shared";
import { portfolioHistoryOptions, portfolioOptions } from "@/lib/queries";
import {
  dashboardBreakdownParsers,
  dashboardRangeParser,
} from "@/lib/search-params";
import { historyScope, scopeId } from "./breakdown";

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

export function useDashboardScope(): {
  scope: PortfolioHistoryScope;
  waiting: boolean;
} {
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const [{ by, scope }] = useQueryStates(dashboardBreakdownParsers);
  const requested = scopeId(historyScope(by, scope, portfolio.apps));
  const shown = useDeferredValue(requested);
  return {
    scope: historyScope(by, shown, portfolio.apps),
    waiting: shown !== requested,
  };
}
