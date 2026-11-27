"use client";

import { useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { ReportHeader } from "@/components/app-detail/ReportHeader";
import { overviewRangeParsers } from "@/lib/search-params";
import { overviewViewTitle, useOverviewView } from "./use-overview-view";

export function OverviewReportHeader({ id }: { id: string }) {
  const t = useTranslations("overview");
  const [ranges] = useQueryStates(overviewRangeParsers);
  const { view } = useOverviewView(id);

  return (
    <ReportHeader
      id={id}
      page={t("views.overview")}
      ranges={[
        {
          label: overviewViewTitle(view, t),
          preset: ranges.range,
        },
        { label: t("views.categoryRanks"), preset: ranges.categoryRange },
      ]}
    />
  );
}
