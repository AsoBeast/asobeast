"use client";

import { useDeferredValue, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import type { ChartKey, ChartPage } from "@asobeast/shared";
import { appsOptions, chartPageOptions } from "@/lib/queries";
import { chartParsers } from "@/lib/search-params";
import { CaptureTodayButton } from "./CaptureTodayButton";
import { candidateApps } from "./chart-actions";
import { ChartEmpty } from "./ChartEmpty";
import { ChartFilters } from "./ChartFilters";
import { chartKeyFrom, chartQueryFrom } from "./chart-params";
import { ChartTable } from "./ChartTable";
import { FollowChartButton } from "./FollowChartButton";
import { TrendingPanel } from "./TrendingPanel";

function ChartActions({ chart, page }: { chart: ChartKey; page: ChartPage }) {
  const capturable = page.dates[0] !== page.today;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {capturable ? <CaptureTodayButton chart={chart} /> : null}
      <FollowChartButton
        chart={chart}
        followed={page.followed}
        primary={!capturable}
      />
    </div>
  );
}

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
  const { data: apps } = useSuspenseQuery(appsOptions);
  const chart = chartKeyFrom(search);
  const actions = <ChartActions chart={chart} page={page} />;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-display tracking-tight text-balance">
            Top charts
          </h1>
          <p className="text-body text-muted-foreground">
            Free, paid and grossing charts by country and category, captured
            once a day.
          </p>
        </div>
        {page.capture ? actions : null}
      </div>
      <ChartFilters
        chart={chart}
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
          <ChartTable page={page} apps={candidateApps(apps, chart.store)} />
          <TrendingPanel page={page} />
        </div>
      ) : (
        <ChartEmpty
          captured={page.dates.length > 0}
          date={date}
          action={actions}
        />
      )}
    </>
  );
}
