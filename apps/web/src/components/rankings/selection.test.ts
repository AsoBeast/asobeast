import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { pickerLabel } from "./selection";

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
