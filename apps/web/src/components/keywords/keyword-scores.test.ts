import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { scoreValue } from "./keyword-cells";

function keyword(scores: Partial<TrackedKeywordItem>): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text: "geography quiz",
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
    serpVolatility7d: null,
    ...scores,
  };
}

describe("scoreValue", () => {
  it.each([
    [0, 0],
    [4.1, 41],
    [10, 100],
    [10.0001, 100],
    [48.2, 100],
    [100, 100],
    [-1, 0],
  ])("renders a stored difficulty of %s as %s", (difficulty, expected) => {
    expect(scoreValue(keyword({ difficulty }), "difficulty")).toBe(expected);
  });

  it("keeps an unscored difficulty null", () => {
    expect(scoreValue(keyword({ difficulty: null }), "difficulty")).toBeNull();
  });

  it.each([62.5, null])(
    "passes traffic volume %s through untouched",
    (volume) => {
      expect(scoreValue(keyword({ traffic: 62.5, volume }), "traffic")).toBe(
        volume,
      );
    },
  );

  it.each([61.3, null])(
    "passes opportunity %s through untouched",
    (opportunity) => {
      expect(scoreValue(keyword({ opportunity }), "opportunity")).toBe(
        opportunity,
      );
    },
  );
});
