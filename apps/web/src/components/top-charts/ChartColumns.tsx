"use client";

import type { AppListItem, ChartPage } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { ChartColumn } from "./ChartColumn";
import type { ChartSearch } from "./chart-params";
import { COLUMNS_GRID } from "./skeletons";
import { TrackedAppsPanel } from "./TrackedAppsPanel";
import { TrendingPanel } from "./TrendingPanel";

export function ChartColumns({
  pages,
  apps,
  busy,
  search,
}: {
  pages: readonly ChartPage[];
  apps: readonly AppListItem[];
  busy: boolean;
  search: Pick<ChartSearch, "compare" | "date">;
}) {
  const t = useTranslations("topCharts");
  return (
    <>
      <TrackedAppsPanel pages={pages} apps={apps} />
      <div aria-busy={busy} className={COLUMNS_GRID}>
        {pages.map((page) => (
          <ChartColumn
            key={page.chart.collection}
            page={page}
            apps={apps}
            search={search}
          />
        ))}
      </div>
      <aside aria-label={t("trending.title")}>
        <TrendingPanel pages={pages} />
      </aside>
    </>
  );
}
