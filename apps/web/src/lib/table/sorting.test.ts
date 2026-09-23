import { KEYWORD_SORTS } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { nullsLast, sortingFromUrl, type SortDefaults } from "./sorting";

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

describe("nullsLast", () => {
  it("turns null into undefined so the table sinks it", () => {
    expect(nullsLast(null)).toBeUndefined();
  });

  it("keeps a zero", () => {
    expect(nullsLast(0)).toBe(0);
  });
});
