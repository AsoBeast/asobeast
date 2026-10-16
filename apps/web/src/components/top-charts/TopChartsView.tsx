"use client";

import { useDeferredValue, useMemo } from "react";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import type { ChartPage } from "@asobeast/shared";
import { appsOptions } from "@/lib/queries";
import { chartParsers } from "@/lib/search-params";
import { candidateApps } from "./chart-actions";
import { categoryDates } from "./chart-column-rows";
import { ChartColumns } from "./ChartColumns";
import { ChartPending } from "./ChartPending";
import { chartCategoryOf } from "./chart-follows";
import { chartPageQueries, pagesOf } from "./chart-pages";
import {
  chartKeyFrom,
  chartQueryFrom,
  shownChartKey,
  type ChartSearchUpdate,
} from "./chart-params";
import { ChartsHeader } from "./ChartsHeader";
import { ChartTableView, TableActions } from "./ChartTableView";
import { ChartToolbar } from "./ChartToolbar";
import { FollowChartButton } from "./FollowChartButton";

function HeaderActions({
  inTable,
  page,
}: {
  inTable: boolean;
  page: ChartPage;
}) {
  if (!inTable) {
    return (
      <FollowChartButton
        category={chartCategoryOf(shownChartKey(page))}
        primary
      />
    );
  }
  return page.capture ? <TableActions page={page} /> : null;
}

export function TopChartsView() {
  const [search, setSearch] = useQueryStates(chartParsers);
  const { view, store, country, collection, genre, device, date, compare } =
    search;
  const request = useMemo(
    () => ({
      view,
      query: chartQueryFrom({
        store,
        country,
        collection,
        genre,
        device,
        date,
        compare,
      }),
    }),
    [view, store, country, collection, genre, device, date, compare],
  );
  const shown = useDeferredValue(request);
  const pages = useSuspenseQueries({
    queries: chartPageQueries(shown.view, shown.query),
    combine: pagesOf,
  });
  const { data: apps } = useSuspenseQuery(appsOptions);
  const [page] = pages;
  const candidates = useMemo(
    () => candidateApps(apps, page.chart.store),
    [apps, page.chart.store],
  );
  const busy = shown !== request;
  const inTable = shown.view === "table";
  const dates = inTable ? page.dates : categoryDates(pages);
  const day = inTable
    ? (page.capture?.date ?? date)
    : (date ?? dates[0] ?? null);

  return (
    <>
      <ChartsHeader actions={<HeaderActions inTable={inTable} page={page} />} />
      <ChartToolbar
        chart={chartKeyFrom(search)}
        view={view}
        compare={compare}
        day={day}
        dates={dates}
        onChange={(next: ChartSearchUpdate) => void setSearch(next)}
      />
      <div className="relative flex flex-col gap-6">
        <ChartPending chart={busy ? chartKeyFrom(search) : null} />
        {inTable ? (
          <ChartTableView
            page={page}
            apps={candidates}
            busy={busy}
            date={date}
          />
        ) : (
          <ChartColumns
            pages={pages}
            apps={candidates}
            busy={busy}
            search={{
              compare: shown.query.compare,
              date: shown.query.date ?? null,
            }}
          />
        )}
      </div>
    </>
  );
}
