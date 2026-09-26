"use client";

import { useQueryStates } from "nuqs";
import { ReportHeader } from "@/components/app-detail/ReportHeader";
import { rankingsRangeParsers } from "@/lib/search-params";

export function RankingsReportHeader({ id }: { id: string }) {
  const [ranges] = useQueryStates(rankingsRangeParsers);

  return (
    <ReportHeader
      id={id}
      page="Rankings"
      ranges={[
        { label: "Ranking history", preset: ranges.range },
        { label: "SERP movers", preset: `${ranges.movers}d` },
      ]}
    />
  );
}
