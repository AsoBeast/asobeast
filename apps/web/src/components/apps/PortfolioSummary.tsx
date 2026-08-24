"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { actionSummaryOptions, portfolioOptions } from "@/lib/queries";
import { PortfolioTotals } from "./PortfolioTotals";

export function PortfolioSummary() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const { data: actions } = useQuery(actionSummaryOptions);
  if (data.apps.length === 0) return null;

  return (
    <PortfolioTotals totals={data.totals} openActions={actions?.open ?? null} />
  );
}
