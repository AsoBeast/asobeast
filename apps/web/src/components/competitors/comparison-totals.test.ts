import { describe, expect, it } from "vitest";
import type { KeywordComparisonRow } from "@asobeast/shared";
import {
  headToHead,
  headToHeadText,
  keywordCountText,
  topTenCount,
} from "./comparison-totals";

const row = (
  you: number | null,
  theirs: number | null,
  unchecked?: string[],
): KeywordComparisonRow => ({
  keywordId: `kw-${you}-${theirs}`,
  text: "keyword",
  country: "us",
  traffic: null,
  difficulty: null,
  you,
  positions: { rival: theirs },
  gap: false,
  ...(unchecked ? { unchecked } : {}),
});

describe("headToHead", () => {
  it("counts a lead when you rank higher or alone, a trail when they do", () => {
    const rows = [
      row(3, 9),
      row(12, 4),
      row(null, 8),
      row(45, null),
      row(7, 2),
    ];
    expect(headToHead(rows, "app", "rival")).toEqual({ lead: 2, trail: 3 });
  });

  it("skips ties, keywords neither ranks for and unchecked apps", () => {
    const rows = [
      row(5, 5),
      row(null, null),
      row(3, null, ["rival"]),
      row(null, 3, ["app"]),
    ];
    expect(headToHead(rows, "app", "rival")).toEqual({ lead: 0, trail: 0 });
  });

  it("treats a competitor without a position entry as not ranking", () => {
    expect(headToHead([row(4, 9)], "app", "someone-else")).toEqual({
      lead: 1,
      trail: 0,
    });
  });
});

describe("topTenCount", () => {
  it("counts checked keywords ranked 10 or better", () => {
    const rows = [row(1, null), row(10, null), row(11, null), row(null, 1)];
    expect(topTenCount(rows, "app")).toBe(2);
    expect(topTenCount([row(2, null, ["app"])], "app")).toBe(0);
  });
});

describe("totals wording", () => {
  it("writes the head to head and the keyword count", () => {
    expect(headToHeadText({ lead: 2, trail: 3 })).toBe("You lead 2, trail 3");
    expect(keywordCountText(1)).toBe("1 keyword");
    expect(keywordCountText(5)).toBe("5 keywords");
  });
});
