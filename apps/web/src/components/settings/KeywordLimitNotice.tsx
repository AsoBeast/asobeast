"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate, formatPlanLimit } from "@/lib/format";
import { budgetOptions } from "@/lib/queries";
import { keywordLimitExceededSince } from "@/lib/quota-usage";

export function KeywordLimitNotice() {
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const since = keywordLimitExceededSince(budget.quota);

  if (!budget.quota || !since) return null;

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>
        Over the keyword limit since {formatDate(since)}. Daily checks cover the
        first {formatPlanLimit(budget.quota.keywordMarkets.limit)} keyword
        markets in a stable order; remove keywords or upgrade to cover the rest.
      </AlertDescription>
    </Alert>
  );
}
