import {
  chartDevicesOf,
  chartGenreName,
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

const COLLECTION_TITLES: Record<CategoryCollection, string> = {
  free: "Top free",
  paid: "Top paid",
  grossing: "Top grossing",
};

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
  return [COLLECTION_TITLES[key.collection], categoryTitle(key)].join(" · ");
}

function categoryParams(category: ChartCategory): URLSearchParams {
  return new URLSearchParams({
    store: category.store,
    country: category.country,
    genre: category.genre,
    device: category.device,
  });
}

export function chartHref(category: ChartCategory): string {
  return `/charts?${categoryParams(category).toString()}`;
}

export function tableHref(
  key: ChartKey,
  { compare, date }: Partial<Pick<ChartSearch, "compare" | "date">> = {},
): string {
  const params = categoryParams(key);
  params.set("view", "table");
  params.set("collection", key.collection);
  if (compare && compare !== "1d") params.set("compare", compare);
  if (date) params.set("date", date);
  return `/charts?${params.toString()}`;
}

export function stepDate(
  dates: readonly string[],
  current: string,
  direction: -1 | 1,
): string | null {
  const sorted = [...dates].sort();
  const found =
    direction === 1
      ? sorted.find((date) => date > current)
      : sorted.findLast((date) => date < current);
  return found ?? null;
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
