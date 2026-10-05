import {
  OVERALL_GENRE,
  type CategoryCollection,
  type CategoryRankSeriesItem,
} from "@asobeast/shared";

const lastCapturedOn = (item: CategoryRankSeriesItem): string =>
  item.points.at(-1)?.date ?? "";

function freshest(
  items: CategoryRankSeriesItem[],
): CategoryRankSeriesItem | undefined {
  return items.reduce<CategoryRankSeriesItem | undefined>(
    (best, item) =>
      best === undefined || lastCapturedOn(item) > lastCapturedOn(best)
        ? item
        : best,
    undefined,
  );
}

function ownCollection(price: number | null): CategoryCollection {
  return price !== null && price > 0 ? "paid" : "free";
}

export function headlineSeries(
  series: CategoryRankSeriesItem[],
  price: number | null,
): CategoryRankSeriesItem | undefined {
  const genreSeries = series.filter((item) => item.genre !== OVERALL_GENRE);
  const pool = genreSeries.length > 0 ? genreSeries : series;
  const preferred = [ownCollection(price), "grossing" as const]
    .map((collection) =>
      freshest(pool.filter((item) => item.collection === collection)),
    )
    .filter((item): item is CategoryRankSeriesItem => item !== undefined);
  return preferred.find((item) => item.current !== null) ?? preferred[0];
}
