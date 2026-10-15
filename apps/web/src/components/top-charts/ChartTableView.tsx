"use client";

import { useDeferredValue, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ChartPageQuery } from "@/lib/api";
import { appsOptions, chartPageOptions } from "@/lib/queries";
import { CaptureTodayButton } from "./CaptureTodayButton";
import { candidateApps } from "./chart-actions";
import { capturableToday } from "./chart-column-rows";
import { ChartEmpty } from "./ChartEmpty";
import { chartCategoryOf } from "./chart-follows";
import {
  chartKeyFrom,
  shownChartKey,
  type ChartSearch,
  type ChartSearchUpdate,
} from "./chart-params";
import { ChartsHeader } from "./ChartsHeader";
import { ChartToolbar } from "./ChartToolbar";
import { ChartTable } from "./ChartTable";
import { FollowChartButton } from "./FollowChartButton";
import { CHART_GRID, TRENDING_COLUMN } from "./skeletons";
import { TrendingPanel } from "./TrendingPanel";

export function ChartTableView({
  search,
  query,
  onChange,
}: {
  search: ChartSearch;
  query: ChartPageQuery;
  onChange: (next: ChartSearchUpdate) => void;
}) {
  const shown = useDeferredValue(query);
  const { data: page } = useSuspenseQuery(chartPageOptions(shown));
  const { data: apps } = useSuspenseQuery(appsOptions);
  const onScreen = shownChartKey(page);
  const candidates = useMemo(
    () => candidateApps(apps, onScreen.store),
    [apps, onScreen.store],
  );
  const capturable = capturableToday(page);
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {capturable ? <CaptureTodayButton chart={onScreen} /> : null}
      <FollowChartButton
        category={chartCategoryOf(onScreen)}
        primary={!capturable}
      />
    </div>
  );

  return (
    <>
      <ChartsHeader actions={page.capture ? actions : null} />
      <ChartToolbar
        chart={chartKeyFrom(search)}
        view={search.view}
        compare={search.compare}
        day={page.capture?.date ?? search.date}
        dates={page.dates}
        onChange={onChange}
      />
      {page.capture ? (
        <div aria-busy={shown !== query} className={CHART_GRID}>
          <ChartTable page={page} apps={candidates} />
          <aside aria-label="Trending" className={TRENDING_COLUMN}>
            <TrendingPanel pages={[page]} />
          </aside>
        </div>
      ) : (
        <ChartEmpty
          captured={page.dates.length > 0}
          date={search.date}
          action={actions}
        />
      )}
    </>
  );
}
