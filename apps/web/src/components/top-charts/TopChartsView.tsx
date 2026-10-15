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
import { chartKeyFrom, chartQueryFrom, shownChartKey } from "./chart-params";
import { ChartTable } from "./ChartTable";
import { FollowChartButton } from "./FollowChartButton";
import { FollowedCharts } from "./FollowedCharts";
import { CHART_GRID } from "./skeletons";
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
  const onScreen = shownChartKey(page);
  const candidates = useMemo(
    () => candidateApps(apps, onScreen.store),
    [apps, onScreen.store],
  );
  const actions = <ChartActions chart={onScreen} page={page} />;

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
        <div className="flex flex-wrap items-center gap-2">
          <FollowedCharts />
          {page.capture ? actions : null}
        </div>
      </div>
      <ChartFilters
        chart={chartKeyFrom(search)}
        compare={compare}
        day={page.capture?.date ?? date}
        dates={page.dates}
        onChange={(next) => void setSearch(next)}
      />
      {page.capture ? (
        <div aria-busy={shown !== query} className={CHART_GRID}>
          <ChartTable page={page} apps={candidates} />
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
