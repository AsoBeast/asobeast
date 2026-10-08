"use client";

import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import type { KeywordImportCost } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { importBudgetNotice, storeBudgetOf } from "@/lib/import-budget";
import { budgetOptions } from "@/lib/queries";

const TONE_VARIANT = {
  info: "default",
  warning: "warning",
  critical: "destructive",
} as const;

export function ImportBudgetNotice({ cost }: { cost: KeywordImportCost }) {
  const { isOperator } = useAuth();
  const { data } = useQuery({ ...budgetOptions, enabled: isOperator });
  const notice = importBudgetNotice(
    cost,
    data ? storeBudgetOf(data.stores, cost.store) : null,
    isOperator,
  );
  if (notice === null) return null;
  return (
    <Alert role="note" variant={TONE_VARIANT[notice.tone]}>
      <Gauge aria-hidden />
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  );
}
