"use client";

import type { AppListItem, ChartPage } from "@asobeast/shared";
import { CaptureTodayButton } from "./CaptureTodayButton";
import { capturableToday, listsNoApps } from "./chart-column-rows";
import { ChartEmpty } from "./ChartEmpty";
import { ChartNoApps } from "./ChartNoApps";
import { chartCategoryOf } from "./chart-follows";
import { shownChartKey } from "./chart-params";
import { ChartTable } from "./ChartTable";
import { FollowChartButton } from "./FollowChartButton";
import { CHART_GRID, TRENDING_COLUMN } from "./skeletons";
import { TrendingPanel } from "./TrendingPanel";

export function TableActions({ page }: { page: ChartPage }) {
  const chart = shownChartKey(page);
  const capturable = capturableToday(page);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {capturable ? <CaptureTodayButton chart={chart} /> : null}
      <FollowChartButton
        category={chartCategoryOf(chart)}
        primary={!capturable}
      />
    </div>
  );
}

export function ChartTableView({
  page,
  apps,
  busy,
  date,
}: {
  page: ChartPage;
  apps: readonly AppListItem[];
  busy: boolean;
  date: string | null;
}) {
  if (listsNoApps(page)) return <ChartNoApps page={page} />;
  return page.capture ? (
    <div aria-busy={busy} className={CHART_GRID}>
      <ChartTable page={page} apps={apps} />
      <aside aria-label="Trending" className={TRENDING_COLUMN}>
        <TrendingPanel pages={[page]} />
      </aside>
    </div>
  ) : (
    <ChartEmpty
      captured={page.dates.length > 0}
      date={date}
      action={<TableActions page={page} />}
    />
  );
}
