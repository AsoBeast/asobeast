import {
  OVERALL_GENRE,
  type CategoryCollection,
  type CategoryRankSeriesItem,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { headlineSeries } from "./category-headline";

const LATEST = Date.UTC(2026, 9, 5);
const DAY_MS = 24 * 60 * 60 * 1000;

const series = (
  collection: CategoryCollection,
  genre: string,
  positions: Array<number | null>,
  lastCapturedDaysAgo = 0,
): CategoryRankSeriesItem => ({
  collection,
  genre,
  genreName: genre === OVERALL_GENRE ? "Overall" : "Games",
  current: positions.at(-1) ?? null,
  points: positions.map((position, index) => ({
    date: new Date(
      LATEST - (lastCapturedDaysAgo + positions.length - 1 - index) * DAY_MS,
    )
      .toISOString()
      .slice(0, 10),
    position,
  })),
});

const PAID_FIRST_PAGE = [
  series("grossing", "6014", [null, null]),
  series("grossing", OVERALL_GENRE, [null, null]),
  series("paid", "6014", [3, 2]),
  series("paid", OVERALL_GENRE, [8, 7]),
];

const pick = (items: CategoryRankSeriesItem[], price: number | null) => {
  const item = headlineSeries(items, price);
  return item && `${item.collection}/${item.genre}`;
};

describe("headlineSeries", () => {
  it("reads the paid genre chart for a paid app although grossing sorts first", () => {
    expect(pick(PAID_FIRST_PAGE, 1.99)).toBe("paid/6014");
  });

  it("reads the free genre chart for a free app", () => {
    expect(
      pick(
        [
          series("free", "6014", [9, 8]),
          series("free", OVERALL_GENRE, [90, 80]),
          series("grossing", "6014", [null, null]),
        ],
        0,
      ),
    ).toBe("free/6014");
  });

  it("treats a missing price as free", () => {
    expect(
      pick([series("free", "6014", [4]), series("paid", "6014", [2])], null),
    ).toBe("free/6014");
  });

  it("keeps a recorded not found on the app's own chart when nothing else ranks", () => {
    expect(
      pick(
        [series("grossing", "6014", [null]), series("paid", "6014", [null])],
        0.99,
      ),
    ).toBe("paid/6014");
  });

  it("falls back to the grossing chart when the app's own chart was never captured", () => {
    expect(
      pick(
        [
          series("grossing", "6014", [34, 31]),
          series("grossing", OVERALL_GENRE, [140, 136]),
        ],
        2.99,
      ),
    ).toBe("grossing/6014");
  });

  it("falls back to the grossing chart when the own chart is captured but not ranked", () => {
    expect(
      pick(
        [series("grossing", "6014", [150]), series("paid", "6014", [null])],
        2.99,
      ),
    ).toBe("grossing/6014");
  });

  it("never reads the chart of the price the app no longer has", () => {
    expect(
      pick(
        [
          series("free", "6014", [30, 25], 20),
          series("grossing", "6014", [null]),
        ],
        4.99,
      ),
    ).toBe("grossing/6014");
    expect(pick([series("paid", "6014", [5, 4], 20)], 0)).toBeUndefined();
  });

  it("never reads an old capture of the app's own chart as its current position", () => {
    expect(
      pick(
        [
          series("free", "6014", [14, 12], 53),
          series("grossing", "6014", [null]),
          series("paid", "6014", [2]),
        ],
        0,
      ),
    ).toBe("grossing/6014");
  });

  it("reads the chart of the current price when the old one is still in the window", () => {
    expect(
      pick(
        [
          series("free", "6014", [12, 8]),
          series("grossing", "6014", [null]),
          series("paid", "6014", [5, 4], 20),
        ],
        0,
      ),
    ).toBe("free/6014");
  });

  it("reads the most recently captured genre when the genre changed inside the window", () => {
    const old = series("paid", "6014", [9, 9], 15);
    const current = series("paid", "6000", [4, 3]);
    expect(pick([old, current], 0.99)).toBe("paid/6000");
    expect(pick([current, old], 0.99)).toBe("paid/6000");
  });

  it("uses the overall chart only when no genre chart exists", () => {
    expect(
      pick(
        [
          series("grossing", OVERALL_GENRE, [null]),
          series("paid", OVERALL_GENRE, [12]),
        ],
        1.99,
      ),
    ).toBe("paid/overall");
    expect(
      pick(
        [
          series("grossing", "6014", [null]),
          series("paid", OVERALL_GENRE, [12]),
        ],
        1.99,
      ),
    ).toBe("grossing/6014");
  });

  it("reads a google play genre chart the same way", () => {
    expect(
      pick(
        [
          series("grossing", "GAME_PUZZLE", [null]),
          series("grossing", OVERALL_GENRE, [null]),
          series("paid", "GAME_PUZZLE", [17]),
          series("paid", OVERALL_GENRE, [120]),
        ],
        0.99,
      ),
    ).toBe("paid/GAME_PUZZLE");
  });

  it("returns nothing without a series", () => {
    expect(headlineSeries([], 1.99)).toBeUndefined();
  });

  it("returns nothing when only the other price's chart exists", () => {
    expect(pick([series("free", "6014", [3])], 1.99)).toBeUndefined();
  });
});
