import {
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
import { createTranslator } from "next-intl";
import enTopCharts from "../../../messages/en/topCharts.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatCountryInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { ChartView } from "@/lib/search-params";
import { genreNameInLocale } from "./genre-name";
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

const english = createTranslator({
  locale: "en",
  namespace: "topCharts",
  messages: { topCharts: enTopCharts },
});

export const COLLECTION_LABELS: Record<CategoryCollection, string> = {
  free: "Free",
  paid: "Paid",
  grossing: "Grossing",
};

export function collectionLabel(
  collection: CategoryCollection,
  t: MessageTranslator = english,
): string {
  return t(`collections.${collection}`);
}

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

export function categoryTitle(
  category: ChartCategory,
  locale: Locale = "en",
): string {
  return [
    genreNameInLocale(
      chartGenreName(category.store, category.genre) ?? category.genre,
      locale,
    ),
    formatCountryInLocale(category.country, locale),
  ].join(" · ");
}

export function chartTitle(
  key: ChartKey,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return [
    t(`collectionTitles.${key.collection}`),
    categoryTitle(key, locale),
  ].join(" · ");
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
