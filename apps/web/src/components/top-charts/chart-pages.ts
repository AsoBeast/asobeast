import type { UseSuspenseQueryResult } from "@tanstack/react-query";
import { CATEGORY_COLLECTIONS, type ChartPage } from "@asobeast/shared";
import type { ChartPageQuery } from "@/lib/api";
import { chartPageOptions } from "@/lib/queries";
import type { ChartView } from "@/lib/search-params";

export function chartPageQueries(view: ChartView, query: ChartPageQuery) {
  return view === "table"
    ? [chartPageOptions(query)]
    : CATEGORY_COLLECTIONS.map((collection) =>
        chartPageOptions({ ...query, collection }),
      );
}

export function pagesOf(
  results: UseSuspenseQueryResult<ChartPage>[],
): ChartPage[] {
  return results.map((result) => result.data);
}
