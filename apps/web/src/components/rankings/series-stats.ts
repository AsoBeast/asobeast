import type { RankingPoint, RankingSeriesItem } from "@asobeast/shared";

export type RangeChange =
  | { kind: "moved"; places: number }
  | { kind: "entered" }
  | { kind: "lost" }
  | { kind: "unranked" };

export interface SeriesStats {
  keywordId: string;
  text: string;
  country: string;
  latest: RankingPoint | null;
  staleSince: string | null;
  change: RangeChange | null;
  best: number | null;
  average: number | null;
}

const byDay = (a: RankingPoint, b: RankingPoint) =>
  a.date.localeCompare(b.date);

function rangeChange(
  first: RankingPoint,
  last: RankingPoint,
): RangeChange | null {
  if (first === last) return null;
  if (first.position !== null && last.position !== null) {
    return { kind: "moved", places: last.position - first.position };
  }
  if (last.position !== null) return { kind: "entered" };
  return first.position === null ? { kind: "unranked" } : { kind: "lost" };
}

export const lastCheckedDay = (
  series: readonly RankingSeriesItem[],
): string | null =>
  series
    .flatMap((item) => item.points.map((point) => point.date))
    .reduce<string | null>(
      (latest, day) => (latest === null || day > latest ? day : latest),
      null,
    );

export function seriesStats(
  item: RankingSeriesItem,
  through: string | null,
): SeriesStats {
  const points = [...item.points].sort(byDay);
  const first = points[0];
  const last = points.at(-1);
  const ranked = points.flatMap((point) =>
    point.position === null ? [] : [point.position],
  );
  return {
    keywordId: item.keywordId,
    text: item.text,
    country: item.country,
    latest: last ?? null,
    staleSince:
      last && through !== null && last.date < through ? last.date : null,
    change: first && last ? rangeChange(first, last) : null,
    best: ranked.length > 0 ? Math.min(...ranked) : null,
    average:
      ranked.length > 0
        ? Math.round(
            ranked.reduce((sum, rank) => sum + rank, 0) / ranked.length,
          )
        : null,
  };
}
