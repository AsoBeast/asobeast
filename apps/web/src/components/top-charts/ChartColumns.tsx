"use client";

import { useDeferredValue } from "react";
import {
  useSuspenseQueries,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import { CATEGORY_COLLECTIONS, type ChartPage } from "@asobeast/shared";
import type { ChartPageQuery } from "@/lib/api";
import { chartPageOptions } from "@/lib/queries";
import { ChartColumn } from "./ChartColumn";
import { categoryDates } from "./chart-column-rows";
import { ChartFilters } from "./ChartFilters";
import { chartCategoryOf } from "./chart-follows";
import {
  chartKeyFrom,
  shownChartKey,
  type ChartSearch,
  type ChartSearchUpdate,
} from "./chart-params";
import { ChartsHeader } from "./ChartsHeader";
import { ChartViewSwitch } from "./ChartViewSwitch";
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
  const dates = categoryDates(pages);
  const shownSearch = { compare: shown.compare, date: shown.date ?? null };

  return (
    <>
      <ChartsHeader
        actions={
          <>
            <ChartViewSwitch
              view={search.view}
              onChange={(view) => onChange({ view })}
            />
            <FollowChartButton
              category={chartCategoryOf(shownChartKey(pages[0]))}
              primary
            />
          </>
        }
      />
      <ChartFilters
        chart={chartKeyFrom(search)}
        withKind={false}
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
