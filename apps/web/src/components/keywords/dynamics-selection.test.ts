import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  cappingLine,
  chartedSelection,
  isCapped,
  withoutKeyword,
} from "./dynamics-selection";

const keyword = (over: Partial<TrackedKeywordItem>): TrackedKeywordItem => ({
  keywordId: "kw-1",
  text: "focus timer",
  tags: [],
  note: null,
  country: "us",
  serpVolatility7d: null,
  source: "TITLE",
  active: true,
  latestPosition: 7,
  latestDepth: 200,
  latestCheckedOn: "2026-10-28",
  previousPosition: 5,
  positionDelta1d: 2,
  positionDelta7d: null,
  traffic: 55,
  difficulty: 4,
  volume: 5000,
  relevance: 90,
  opportunity: 82,
  bucket: "primary",
  scoredAt: "2026-10-28",
  scoreProvenance: null,
  ...over,
});

const tracked = Array.from({ length: 12 }, (_, index) =>
  keyword({
    keywordId: `kw-${index + 1}`,
    text: `keyword ${index + 1}`,
    opportunity: 90 - index,
  }),
);

describe("chartedSelection", () => {
  it("caps the charted ids at eight in the order of the selection", () => {
    const selected = tracked.map((item) => item.keywordId).reverse();
    const { effective, charted } = chartedSelection(selected, tracked);
    expect(effective).toHaveLength(12);
    expect(charted).toHaveLength(8);
    expect(charted).toEqual([
      "kw-12",
      "kw-11",
      "kw-10",
      "kw-9",
      "kw-8",
      "kw-7",
      "kw-6",
      "kw-5",
    ]);
  });

  it("keeps a selection of eight or fewer whole", () => {
    const selected = ["kw-3", "kw-1", "kw-7"];
    expect(chartedSelection(selected, tracked)).toEqual({
      effective: selected,
      charted: selected,
    });
  });

  it("drops ids the market no longer tracks", () => {
    const { effective, charted } = chartedSelection(
      ["kw-2", "kw-gone", "kw-4"],
      tracked,
    );
    expect(effective).toEqual(["kw-2", "kw-4"]);
    expect(charted).toEqual(["kw-2", "kw-4"]);
  });

  it("falls back to the top by opportunity when nothing survives", () => {
    const { effective, charted } = chartedSelection(["kw-gone"], tracked);
    expect(effective).toEqual(["kw-1", "kw-2", "kw-3", "kw-4", "kw-5"]);
    expect(charted).toEqual(effective);
  });
});

describe("isCapped", () => {
  it("is true when the selection exceeds the chart cap", () => {
    const selection = chartedSelection(
      tracked.map((item) => item.keywordId),
      tracked,
    );
    expect(isCapped(selection)).toBe(true);
    expect(cappingLine(selection)).toBe("Charting 8 of 12 keywords.");
  });

  it("is false at the cap and below", () => {
    expect(isCapped(chartedSelection(["kw-1"], tracked))).toBe(false);
  });
});

describe("withoutKeyword", () => {
  it("removes one id and keeps the rest", () => {
    expect(withoutKeyword(["kw-1", "kw-2", "kw-3"], "kw-2")).toEqual([
      "kw-1",
      "kw-3",
    ]);
  });

  it("empties when the last id goes", () => {
    expect(withoutKeyword(["kw-2"], "kw-2")).toEqual([]);
  });
});
