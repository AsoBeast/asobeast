"use client";

import { useDeferredValue, useMemo } from "react";
import {
  useSuspenseQueries,
  useSuspenseQuery,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import { CATEGORY_COLLECTIONS, type ChartPage } from "@asobeast/shared";
import type { ChartPageQuery } from "@/lib/api";
import { appsOptions, chartPageOptions } from "@/lib/queries";
import { candidateApps } from "./chart-actions";
import { ChartColumn } from "./ChartColumn";
import { categoryDates } from "./chart-column-rows";
import { chartCategoryOf } from "./chart-follows";
import {
  chartKeyFrom,
  shownChartKey,
  type ChartSearch,
  type ChartSearchUpdate,
} from "./chart-params";
import { ChartsHeader } from "./ChartsHeader";
import { ChartToolbar } from "./ChartToolbar";
import { FollowChartButton } from "./FollowChartButton";
import { COLUMNS_GRID } from "./skeletons";
import { TrendingPanel } from "./TrendingPanel";

function pagesOf(results: UseSuspenseQueryResult<ChartPage>[]): ChartPage[] {
  return results.map((result) => result.data);
}

export function ChartColumns({
  search,
  query,
  onChange,
}: {
  search: ChartSearch;
  query: ChartPageQuery;
  onChange: (next: ChartSearchUpdate) => void;
}) {
  const shown = useDeferredValue(query);
  const pages = useSuspenseQueries({
    queries: CATEGORY_COLLECTIONS.map((collection) =>
      chartPageOptions({ ...shown, collection }),
    ),
    combine: pagesOf,
  });
  const { data: apps } = useSuspenseQuery(appsOptions);
  const store = pages[0].chart.store;
  const candidates = useMemo(() => candidateApps(apps, store), [apps, store]);
  const dates = categoryDates(pages);
  const shownSearch = { compare: shown.compare, date: shown.date ?? null };

  return (
    <>
      <ChartsHeader
        actions={
          <FollowChartButton
            category={chartCategoryOf(shownChartKey(pages[0]))}
            primary
          />
        }
      />
      <ChartToolbar
        chart={chartKeyFrom(search)}
        view={search.view}
        compare={search.compare}
        day={search.date ?? dates[0] ?? null}
        dates={dates}
        onChange={onChange}
      />
      <div aria-busy={shown !== query} className={COLUMNS_GRID}>
        {pages.map((page) => (
          <ChartColumn
            key={page.chart.collection}
            page={page}
            apps={candidates}
            search={shownSearch}
          />
        ))}
      </div>
      <aside aria-label="Trending">
        <TrendingPanel pages={pages} />
      </aside>
    </>
  );
}
