"use client";

"use client";

import type { ChartCaptureSummary, ChartPage } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { noAppsBody } from "./chart-actions";
import { useAppLocale } from "@/lib/use-app-locale";

export function ChartNoApps({
  page,
  className,
}: {
  page: Pick<ChartPage, "chart"> & { capture: ChartCaptureSummary };
  className?: string;
}) {
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  return (
    <EmptyState
      className={className}
      title={t("empty.noApps")}
      body={noAppsBody(page.chart, page.capture.date, t, locale)}
    />
  );
}
