import {
  SERP_DEPTH,
  type SerpEntryItem,
  type SerpSnapshot,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import type { Moved } from "@/components/movement/movement-text";
import { serpRole, type SerpViewer } from "./serp-csv";

export type PositionSummary =
  | { kind: "listed"; position: number; moved: Moved }
  | { kind: "deeper"; position: number; listed: number }
  | { kind: "notFound"; depth: number }
  | { kind: "absent" };

export interface TitleSummary {
  withKeyword: number;
  of: number;
}

export type RatingSummary =
  | { kind: "median"; value: number }
  | { kind: "average"; value: number }
  | { kind: "none" };

export interface SerpSummaryFacts {
  position: PositionSummary;
  titles: TitleSummary | null;
  ratings: RatingSummary;
}

type CheckedKeyword = Pick<
  TrackedKeywordItem,
  "latestPosition" | "latestDepth"
>;

export const movedOf = (entry: SerpEntryItem): Moved => ({
  movement: entry.movement ?? "none",
  delta: entry.delta ?? null,
  previous: entry.previous ?? null,
});

export const isNewestDay = (snapshot: SerpSnapshot): boolean =>
  snapshot.dates === undefined || snapshot.date === snapshot.dates[0];

function positionOf(
  snapshot: SerpSnapshot,
  viewer: SerpViewer,
  keyword: CheckedKeyword | undefined,
): PositionSummary {
  const yours = snapshot.entries.find(
    (entry) => serpRole(entry, viewer) === "you",
  );
  if (yours) {
    return { kind: "listed", position: yours.position, moved: movedOf(yours) };
  }
  if (!keyword || !isNewestDay(snapshot)) return { kind: "absent" };
  const { latestPosition, latestDepth } = keyword;
  if (latestPosition !== null && latestPosition > snapshot.entries.length) {
    return {
      kind: "deeper",
      position: latestPosition,
      listed: snapshot.entries.length,
    };
  }
  if (latestPosition === null && latestDepth !== null) {
    return { kind: "notFound", depth: latestDepth };
  }
  return { kind: "absent" };
}

function titlesOf(topTen: readonly SerpEntryItem[]): TitleSummary | null {
  if (!topTen.some((entry) => entry.titleMatch !== undefined)) return null;
  return {
    withKeyword: topTen.filter((entry) => entry.titleMatch === "phrase").length,
    of: topTen.length,
  };
}

const present = (values: (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null);

function ratingsOf(topTen: readonly SerpEntryItem[]): RatingSummary {
  const counts = present(topTen.map((entry) => entry.ratingCount)).sort(
    (a, b) => a - b,
  );
  if (counts.length > 0) {
    return {
      kind: "median",
      value: counts[Math.floor((counts.length - 1) / 2)],
    };
  }
  const ratings = present(topTen.map((entry) => entry.ratingAvg));
  if (ratings.length > 0) {
    const sum = ratings.reduce((total, rating) => total + rating, 0);
    return { kind: "average", value: sum / ratings.length };
  }
  return { kind: "none" };
}

export function serpSummary(
  snapshot: SerpSnapshot,
  viewer: SerpViewer,
  keyword?: CheckedKeyword,
): SerpSummaryFacts {
  const topTen = snapshot.entries.filter(
    (entry) => entry.position <= SERP_DEPTH,
  );
  return {
    position: positionOf(snapshot, viewer, keyword),
    titles: titlesOf(topTen),
    ratings: ratingsOf(topTen),
  };
}
