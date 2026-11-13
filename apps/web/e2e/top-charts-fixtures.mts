import type {
  CategoryCollection,
  ChartEntryItem,
  ChartMover,
  ChartPage,
} from "@asobeast/shared";
import { TOP_CHART_APPS, TOP_CHART_DATES, topChartPage } from "./fixtures.mts";

export const DEEP_CHART_COOKIE = "e2e_chart_deep";

export const DEEP_CHART_DEPTH = 40;

export const DEEP_LONG_TITLE =
  "Crossword Kingdom: Daily Word Puzzles, Anagrams and Brain Training Games";

export const DEEP_RTL_TITLE = "لعبة الكلمات المتقاطعة اليومية";

export const DEEP_OWN_POSITIONS = [3, 5, 6, 9, 31];

const DEEP_COMPETITOR_POSITIONS = [28, 30, 27, 33, 35];

const [, , OWN, , COMPETITOR] = TOP_CHART_APPS;

const KIND_OFFSET: Record<CategoryCollection, number> = {
  free: 1,
  paid: 2,
  grossing: 3,
};

const SPECIAL_TITLES: Record<number, string> = {
  5: DEEP_LONG_TITLE,
  6: DEEP_RTL_TITLE,
};

interface Slot {
  storeAppId: string;
  title: string;
}

function fillers(collection: CategoryCollection): Slot[] {
  return Array.from({ length: DEEP_CHART_DEPTH - 2 }, (_, index) => ({
    storeAppId: String(6_600_000_000 + KIND_OFFSET[collection] * 1000 + index),
    title: SPECIAL_TITLES[index] ?? `Arcade Game ${index + 1}`,
  }));
}

function placed(slots: Slot[], slot: Slot, position: number): Slot[] {
  return [...slots.slice(0, position - 1), slot, ...slots.slice(position - 1)];
}

function orderOn(day: number, collection: CategoryCollection): Slot[] {
  const rotated = fillers(collection);
  for (let index = day % 3; index + 1 < rotated.length; index += 3) {
    [rotated[index], rotated[index + 1]] = [rotated[index + 1], rotated[index]];
  }
  if (collection !== "free") {
    return rotated.slice(0, DEEP_CHART_DEPTH);
  }
  const [first, second] = [
    { slot: OWN, position: DEEP_OWN_POSITIONS[day] },
    { slot: COMPETITOR, position: DEEP_COMPETITOR_POSITIONS[day] },
  ].sort((a, b) => a.position - b.position);
  return placed(
    placed(rotated, first.slot, first.position),
    second.slot,
    second.position,
  );
}

function movementOf(
  position: number,
  previous: number | null,
): ChartEntryItem["movement"] {
  if (previous === null) return "new";
  if (previous === position) return "same";
  return previous > position ? "up" : "down";
}

function entriesOn(
  day: number,
  collection: CategoryCollection,
): ChartEntryItem[] {
  const earlier =
    day + 1 < TOP_CHART_DATES.length ? orderOn(day + 1, collection) : null;
  return orderOn(day, collection).map((slot, index) => {
    const position = index + 1;
    const found = earlier?.findIndex(
      (candidate) => candidate.storeAppId === slot.storeAppId,
    );
    const previous = found === undefined || found < 0 ? null : found + 1;
    return {
      position,
      storeAppId: slot.storeAppId,
      title: slot.title,
      developer: `${slot.title.split(" ")[0]} Labs`,
      iconUrl: null,
      genreId: "6014",
      genreName: "Games",
      free: collection !== "paid",
      previous,
      delta: previous === null ? null : position - previous,
      movement: earlier ? movementOf(position, previous) : "none",
    };
  });
}

const moverOf = (entry: ChartEntryItem): ChartMover => ({
  storeAppId: entry.storeAppId,
  title: entry.title,
  developer: entry.developer,
  iconUrl: entry.iconUrl,
  position: entry.position,
  previous: entry.previous,
  delta: entry.delta,
});

function moversOf(
  entries: ChartEntryItem[],
  movement: ChartEntryItem["movement"],
): ChartMover[] {
  return entries
    .filter((entry) => entry.movement === movement)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, 10)
    .map(moverOf);
}

export function deepChartPage(
  date: string | null,
  collection: CategoryCollection,
): ChartPage | null {
  const day = date ? TOP_CHART_DATES.indexOf(date) : 0;
  if (day < 0) return null;
  const entries = entriesOn(day, collection);
  return {
    ...topChartPage(TOP_CHART_DATES[day], collection),
    entries,
    trending: {
      climbers: moversOf(entries, "up"),
      fallers: moversOf(entries, "down"),
      entries: moversOf(entries, "new"),
      exits: [],
    },
  };
}
