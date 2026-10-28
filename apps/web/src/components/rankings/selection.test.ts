import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { pickerLabel, selectionForMarket } from "./selection";

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

describe("pickerLabel", () => {
  it("appends the market when the tracked keywords span several markets", () => {
    const label = pickerLabel([
      keyword({ keywordId: "kw-1", country: "us" }),
      keyword({ keywordId: "kw-2", text: "pomodoro", country: "de" }),
    ]);
    expect(label(keyword({ keywordId: "kw-1" }))).toBe("focus timer (US)");
  });

  it("keeps the bare text when every tracked keyword is in one market", () => {
    const label = pickerLabel([
      keyword({ keywordId: "kw-1" }),
      keyword({ keywordId: "kw-2", text: "pomodoro" }),
    ]);
    expect(label(keyword({ keywordId: "kw-2", text: "pomodoro" }))).toBe(
      "pomodoro",
    );
  });

  it("names an empty list as a single market", () => {
    expect(pickerLabel([])(keyword({ keywordId: "kw-1" }))).toBe("focus timer");
  });
});

describe("selectionForMarket", () => {
  const usTracked = [
    keyword({ keywordId: "kw-1", opportunity: 80 }),
    keyword({ keywordId: "kw-2", text: "pomodoro", opportunity: 60 }),
  ];
  const deKeyword = keyword({
    keywordId: "kw-de",
    text: "pomodoro",
    country: "de",
    opportunity: 90,
  });

  it("keeps the selected keywords the market tracks", () => {
    expect(selectionForMarket(usTracked, ["kw-1", "kw-de"])).toEqual(["kw-1"]);
  });

  it("falls back to the top by opportunity when nothing survives", () => {
    expect(selectionForMarket(usTracked, [deKeyword.keywordId])).toEqual([
      "kw-1",
      "kw-2",
    ]);
  });

  it("falls back when the selection is empty", () => {
    expect(selectionForMarket(usTracked, [])).toEqual(["kw-1", "kw-2"]);
  });

  it("keeps order with a partial selection", () => {
    expect(selectionForMarket(usTracked, ["kw-2", "kw-1"])).toEqual([
      "kw-2",
      "kw-1",
    ]);
  });
});
