import type { ChartCompareWindow, ChartKey, ChartPage } from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export interface ChartPageQuery extends ChartKey {
  date?: string;
  compare: ChartCompareWindow;
}

export function getChart(query: ChartPageQuery): Promise<ChartPage> {
  const params = new URLSearchParams({
    store: query.store,
    country: query.country,
    collection: query.collection,
    genre: query.genre,
    device: query.device,
    compare: query.compare,
    ...(query.date ? { date: query.date } : {}),
  });
  return apiFetch<ChartPage>(withQuery("/charts", params));
}
