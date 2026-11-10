"use client";

import { useQueryState, useQueryStates } from "nuqs";
import { ReportHeader } from "@/components/app-detail/ReportHeader";
import {
  overviewRangeParsers,
  visibilityViewParser,
} from "@/lib/search-params";
import { OVERVIEW_CHARTS } from "./OverviewChart";

export function OverviewReportHeader({ id }: { id: string }) {
  const [ranges] = useQueryStates(overviewRangeParsers);
  const [view] = useQueryState("visView", visibilityViewParser);

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
