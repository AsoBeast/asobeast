"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { accountPlanOptions } from "@/lib/queries";
import { emptyChartBody } from "./chart-actions";

export function ChartEmpty({
  captured,
  date,
  action,
  className,
}: {
  captured: boolean;
  date: string | null;
  action?: ReactNode;
  className?: string;
}) {
  const limits = useQuery(accountPlanOptions).data?.limits;
  return (
    <EmptyState
      className={className}
      title={
        captured
          ? `No capture of this chart on ${formatDate(date)}`
          : "This chart has not been captured yet"
      }
      body={emptyChartBody(captured, limits)}
      action={action}
    />
  );
}
