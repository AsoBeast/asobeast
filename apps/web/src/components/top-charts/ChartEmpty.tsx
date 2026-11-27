"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
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
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  const limits = useQuery(accountPlanOptions).data?.limits;
  return (
    <EmptyState
      className={className}
      title={
        captured && date !== null
          ? t("empty.noCaptureOn", {
              date: formatDateInLocale(date, locale),
            })
          : t("empty.notCaptured")
      }
      body={emptyChartBody(captured, limits, t)}
      action={action}
    />
  );
}
