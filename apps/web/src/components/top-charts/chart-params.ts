import {
  CHART_COLLECTION_TITLES,
  chartColumnsPath,
  chartDevicesOf,
  chartGenreName,
  chartTablePath,
  DEFAULT_COUNTRY,
  defaultChartDevice,
  isChartGenre,
  isStorefront,
  OVERALL_GENRE,
  type CategoryCollection,
  type ChartCompareWindow,
  type ChartDevice,
  type ChartKey,
  type ChartPage,
  type Store,
} from "@asobeast/shared";
import type { ChartPageQuery } from "@/lib/api";
import { formatCountry } from "@/lib/format";
import type { ChartView } from "@/lib/search-params";
import type { ChartCategory } from "./chart-follows";

export interface ChartSearch {
  view: ChartView;
  store: Store;
  country: string;
  collection: CategoryCollection;
  genre: string;
  device: ChartDevice | null;
  date: string | null;
  compare: ChartCompareWindow;
}

export type ChartSearchUpdate = {
  [Key in keyof ChartSearch]?: ChartSearch[Key] | null;
};

export const COLLECTION_LABELS: Record<CategoryCollection, string> = {
  free: "Free",
  paid: "Paid",
  grossing: "Grossing",
};

export const chartHref = chartColumnsPath;
export const tableHref = chartTablePath;

export function chartKeyFrom(search: Omit<ChartSearch, "view">): ChartKey {
  const { store, collection } = search;
  return {
    store,
    country: isStorefront(store, search.country)
      ? search.country
      : DEFAULT_COUNTRY,
    collection,
    genre: isChartGenre(store, search.genre) ? search.genre : OVERALL_GENRE,
    device:
      search.device && chartDevicesOf(store).includes(search.device)
        ? search.device
        : defaultChartDevice(store),
  };
}

export function shownChartKey(page: Pick<ChartPage, "chart">): ChartKey {
  const { store, country, collection, genre, device } = page.chart;
  return { store, country, collection, genre, device };
}

export function chartQueryFrom(
  search: Omit<ChartSearch, "view">,
): ChartPageQuery {
  return {
    ...chartKeyFrom(search),
    compare: search.compare,
    ...(search.date ? { date: search.date } : {}),
  };
}

export function categoryTitle(category: ChartCategory): string {
  return [
    chartGenreName(category.store, category.genre) ?? category.genre,
    formatCountry(category.country),
  ].join(" · ");
}

export function chartTitle(key: ChartKey): string {
  return [CHART_COLLECTION_TITLES[key.collection], categoryTitle(key)].join(
    " · ",
  );
}

export function storeChanged(
  next: Store,
  current: Pick<ChartSearch, "country">,
): ChartSearchUpdate {
  return {
    store: next,
    genre: null,
    device: null,
    date: null,
    country: isStorefront(next, current.country) ? current.country : null,
  };
}
