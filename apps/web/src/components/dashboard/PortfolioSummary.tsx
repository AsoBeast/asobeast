"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { actionSummaryOptions, portfolioOptions } from "@/lib/queries";
import { PortfolioTotals } from "./PortfolioTotals";

export function PortfolioSummary() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const { data: actions } = useSuspenseQuery(actionSummaryOptions);
  if (data.apps.length === 0) return null;

  return (
    <PortfolioTotals
      totals={data.totals}
      openActions={actions.generatedAt === null ? null : actions.open}
    />
  );
}
