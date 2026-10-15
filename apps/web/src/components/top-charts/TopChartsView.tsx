"use client";

import { useDeferredValue, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { chartPageOptions } from "@/lib/queries";
import { chartParsers } from "@/lib/search-params";
import { ChartEmpty } from "./ChartEmpty";
import { ChartFilters } from "./ChartFilters";
import { chartKeyFrom, chartQueryFrom } from "./chart-params";
import { ChartTable } from "./ChartTable";
import { TrendingPanel } from "./TrendingPanel";

export function TopChartsView() {
  const [search, setSearch] = useQueryStates(chartParsers);
  const { store, country, collection, genre, device, date, compare } = search;
  const query = useMemo(
    () =>
      chartQueryFrom({
        store,
        country,
        collection,
        genre,
        device,
        date,
        compare,
      }),
    [store, country, collection, genre, device, date, compare],
  );
  const shown = useDeferredValue(query);
  const { data: page } = useSuspenseQuery(chartPageOptions(shown));

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-display tracking-tight text-balance">Top charts</h1>
        <p className="text-body text-muted-foreground">
          Free, paid and grossing charts by country and category, captured once
          a day.
        </p>
      </div>
      <ChartFilters
        chart={chartKeyFrom(search)}
        compare={compare}
        day={page.capture?.date ?? date}
        dates={page.dates}
        onChange={(next) => void setSearch(next)}
      />
      {page.capture ? (
        <div
          aria-busy={shown !== query}
          className="grid gap-6 @6xl/charts:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0"
        >
          <ChartTable page={page} />
          <TrendingPanel page={page} />
        </div>
      ) : (
        <ChartEmpty captured={page.dates.length > 0} date={date} />
      )}
    </>
  );
}
