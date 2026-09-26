"use client";

import { useQueryStates } from "nuqs";
import { ReportHeader } from "@/components/app-detail/ReportHeader";
import { overviewRangeParsers } from "@/lib/search-params";

export function OverviewReportHeader({ id }: { id: string }) {
  const [ranges] = useQueryStates(overviewRangeParsers);

  return (
    <ReportHeader
      id={id}
      page="Overview"
      ranges={[
        { label: "Visibility", preset: ranges.range },
        { label: "Rank bands", preset: ranges.distRange },
        { label: "Category ranks", preset: ranges.categoryRange },
      ]}
    />
  );
}
