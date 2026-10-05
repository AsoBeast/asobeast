import {
  OVERALL_GENRE,
  type CategoryCollection,
  type CategoryRankSeriesItem,
} from "@asobeast/shared";

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
  const preferred = [ownCollection(price), "grossing" as const]
    .map((collection) => pool.find((item) => item.collection === collection))
    .filter((item): item is CategoryRankSeriesItem => item !== undefined);
  return preferred.find((item) => item.current !== null) ?? preferred[0];
}
