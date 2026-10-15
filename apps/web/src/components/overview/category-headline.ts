import {
  defaultChartDevice,
  OVERALL_GENRE,
  type CategoryCollection,
  type CategoryRankSeriesItem,
  type Store,
} from "@asobeast/shared";
import { tableHref } from "@/components/top-charts/chart-params";

const LEGACY_CHART_DEPTH = 200;

const depthOf = (item: CategoryRankSeriesItem): number =>
  item.depth ?? LEGACY_CHART_DEPTH;

export function chartDepthOf(series: CategoryRankSeriesItem[]): number {
  return series.length === 0
    ? LEGACY_CHART_DEPTH
    : Math.max(...series.map(depthOf));
}

export function notInChartLabel(item: CategoryRankSeriesItem): string {
  return `Not in top ${depthOf(item)} in ${item.genreName}`;
}

const lastCapturedOn = (item: CategoryRankSeriesItem): string =>
  item.points.at(-1)?.date ?? "";

function ownCollection(price: number | null): CategoryCollection {
  return price !== null && price > 0 ? "paid" : "free";
}

export function headlineSeries(
  series: CategoryRankSeriesItem[],
  price: number | null,
): CategoryRankSeriesItem | undefined {
  const newest = series.map(lastCapturedOn).sort().at(-1);
  const current = series.filter((item) => lastCapturedOn(item) === newest);
  const genreSeries = current.filter((item) => item.genre !== OVERALL_GENRE);
  const pool = genreSeries.length > 0 ? genreSeries : current;
  const collections: CategoryCollection[] = [ownCollection(price), "grossing"];
  const preferred = collections
    .map((collection) => pool.find((item) => item.collection === collection))
    .filter((item): item is CategoryRankSeriesItem => item !== undefined);
  return preferred.find((item) => item.current !== null) ?? preferred[0];
}

export function headlineChartHref(
  headline: CategoryRankSeriesItem,
  app: { store: Store; country: string },
): string {
  return tableHref({
    store: app.store,
    country: app.country,
    collection: headline.collection,
    genre: headline.genre,
    device: defaultChartDevice(app.store),
  });
}
