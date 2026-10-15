"use client";

import { useMemo } from "react";
import { useQueryStates } from "nuqs";
import { chartParsers } from "@/lib/search-params";
import { ChartColumns } from "./ChartColumns";
import { chartQueryFrom, type ChartSearchUpdate } from "./chart-params";
import { ChartTableView } from "./ChartTableView";

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
  const onChange = (next: ChartSearchUpdate) => void setSearch(next);

  return search.view === "table" ? (
    <ChartTableView search={search} query={query} onChange={onChange} />
  ) : (
    <ChartColumns search={search} query={query} onChange={onChange} />
  );
}
