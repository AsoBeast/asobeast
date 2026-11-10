"use client";

import { useQueryStates } from "nuqs";
import { ReportHeader } from "@/components/app-detail/ReportHeader";
import { overviewRangeParsers } from "@/lib/search-params";
import { OVERVIEW_VIEW_TITLES, useOverviewView } from "./use-overview-view";

export function OverviewReportHeader({ id }: { id: string }) {
  const [ranges] = useQueryStates(overviewRangeParsers);
  const { view } = useOverviewView(id);

  return (
    <ReportHeader
      id={id}
      page="Overview"
      ranges={[
        { label: OVERVIEW_VIEW_TITLES[view], preset: ranges.range },
        { label: "Category ranks", preset: ranges.categoryRange },
      ]}
    />
  );
}
