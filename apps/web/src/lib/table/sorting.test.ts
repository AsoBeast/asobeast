import { KEYWORD_SORTS } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  ariaSort,
  nullsLast,
  sortDefaultsOf,
  sortingFromUrl,
  urlFromSorting,
  type SortDefaults,
} from "./sorting";

const DEFAULTS: SortDefaults = {
  descFirst: new Set(["traffic", "difficulty", "opportunity", "volatility"]),
};

describe("sortingFromUrl", () => {
  it("sorts position ascending when the url names no direction", () => {
    expect(sortingFromUrl("position", null, DEFAULTS)).toEqual([
      { id: "position", desc: false },
    ]);
  });

  it.each(KEYWORD_SORTS.filter((sort) => sort !== "position"))(
    "sorts %s descending when the url names no direction",
    (sort) => {
      expect(sortingFromUrl(sort, null, DEFAULTS)).toEqual([
        { id: sort, desc: true },
      ]);
    },
  );
});

describe("sortingFromUrl with a direction", () => {
  it("lets the url reverse the natural direction", () => {
    expect(sortingFromUrl("traffic", "asc", DEFAULTS)).toEqual([
      { id: "traffic", desc: false },
    ]);
  });

  it("keeps an explicit descending direction", () => {
    expect(sortingFromUrl("position", "desc", DEFAULTS)).toEqual([
      { id: "position", desc: true },
    ]);
  });
});

describe("urlFromSorting", () => {
  it("drops the direction when it is the column's natural one", () => {
    expect(urlFromSorting([{ id: "traffic", desc: true }], DEFAULTS)).toEqual({
      sort: "traffic",
      dir: null,
    });
  });

  it("writes ascending when a descending column is reversed", () => {
    expect(urlFromSorting([{ id: "traffic", desc: false }], DEFAULTS)).toEqual({
      sort: "traffic",
      dir: "asc",
    });
  });

  it("drops the direction for position ascending", () => {
    expect(urlFromSorting([{ id: "position", desc: false }], DEFAULTS)).toEqual(
      { sort: "position", dir: null },
    );
  });

  it("writes descending when position is reversed", () => {
    expect(urlFromSorting([{ id: "position", desc: true }], DEFAULTS)).toEqual({
      sort: "position",
      dir: "desc",
    });
  });

  it("clears both keys for an empty state", () => {
    expect(urlFromSorting([], DEFAULTS)).toEqual({ sort: null, dir: null });
  });
});

describe("ariaSort", () => {
  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
    [false, undefined],
  ] as const)("maps %s to %s", (sorted, expected) => {
    expect(ariaSort(sorted)).toBe(expected);
  });
});

describe("nullsLast", () => {
  it("turns null into undefined so the table sinks it", () => {
    expect(nullsLast(null)).toBeUndefined();
  });

  it("keeps a zero", () => {
    expect(nullsLast(0)).toBe(0);
  });
});

describe("sortDefaultsOf", () => {
  it("reads the natural direction from the column definitions", () => {
    expect(
      sortDefaultsOf([
        { id: "keyword", sortDescFirst: false },
        { id: "traffic", sortDescFirst: true },
        { id: "select" },
        { sortDescFirst: true },
      ]),
    ).toEqual({ descFirst: new Set(["traffic"]) });
  });
});
