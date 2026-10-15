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

export interface ChartSearch {
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

const COLLECTION_TITLES: Record<CategoryCollection, string> = {
  free: "Top free",
  paid: "Top paid",
  grossing: "Top grossing",
};

export function chartKeyFrom(search: ChartSearch): ChartKey {
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

export function chartQueryFrom(search: ChartSearch): ChartPageQuery {
  return {
    ...chartKeyFrom(search),
    compare: search.compare,
    ...(search.date ? { date: search.date } : {}),
  };
}

export function chartTitle(key: ChartKey): string {
  return [
    COLLECTION_TITLES[key.collection],
    chartGenreName(key.store, key.genre) ?? key.genre,
    formatCountry(key.country),
  ].join(" · ");
}

export function chartHref(key: ChartKey): string {
  const params = new URLSearchParams({
    store: key.store,
    country: key.country,
    collection: key.collection,
    genre: key.genre,
    device: key.device,
  });
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
