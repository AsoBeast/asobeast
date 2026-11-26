"use client";

import { useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { ReportHeader } from "@/components/app-detail/ReportHeader";
import { rankingsRangeParsers } from "@/lib/search-params";

export function RankingsReportHeader({ id }: { id: string }) {
  const t = useTranslations("rankings");
  const [ranges] = useQueryStates(rankingsRangeParsers);

  return (
    <ReportHeader
      id={id}
      page={t("title")}
      ranges={[
        { label: t("rankingHistory"), preset: ranges.range },
        { label: t("serpMovers"), preset: `${ranges.movers}d` },
      ]}
    />
  );
}
