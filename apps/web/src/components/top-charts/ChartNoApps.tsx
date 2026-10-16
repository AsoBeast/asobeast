"use client";

import { Trophy } from "lucide-react";
import type { ChartCaptureSummary, ChartPage } from "@asobeast/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { noAppsBody } from "./chart-actions";

export function ChartNoApps({
  page,
  className,
}: {
  page: Pick<ChartPage, "chart"> & { capture: ChartCaptureSummary };
  className?: string;
}) {
  return (
    <EmptyState
      className={className}
      icon={Trophy}
      title="No apps in this chart"
      body={noAppsBody(page.chart, page.capture.date)}
    />
  );
}
