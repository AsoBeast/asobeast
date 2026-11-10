"use client";

import { useQueryStates } from "nuqs";
import { ReportHeader } from "@/components/app-detail/ReportHeader";
import { overviewRangeParsers } from "@/lib/search-params";
import { OVERVIEW_CHARTS } from "./OverviewChart";
import { useOverviewView } from "./use-overview-view";

export function OverviewReportHeader({ id }: { id: string }) {
  const [ranges] = useQueryStates(overviewRangeParsers);
  const { view } = useOverviewView(id);

  return (
    <ReportHeader
      id={id}
      page="Overview"
      ranges={[
        { label: OVERVIEW_CHARTS[view].title, preset: ranges.range },
        { label: "Category ranks", preset: ranges.categoryRange },
      ]}
    />
  );
}
