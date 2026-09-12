import { describe, expect, it } from "vitest";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { comparisonScoreLabel } from "./comparison-scores";

function row(
  traffic: number | null,
  difficulty: number | null,
): KeywordComparisonRow {
  return {
    keywordId: "kw-1",
    text: "geography quiz",
    traffic,
    difficulty,
    you: null,
    positions: {},
    gap: false,
  };
}

describe("comparisonScoreLabel", () => {
  it.each([
    [0, "0"],
    [4.1, "41"],
    [10, "100"],
    [10.0001, "100"],
    [48.2, "100"],
    [-1, "0"],
  ])("labels a stored score of %s as %s", (score, expected) => {
    expect(comparisonScoreLabel(row(score, null), "traffic")).toBe(expected);
    expect(comparisonScoreLabel(row(null, score), "difficulty")).toBe(expected);
  });

  it("labels an unscored keyword with an em dash", () => {
    expect(comparisonScoreLabel(row(null, null), "traffic")).toBe("—");
    expect(comparisonScoreLabel(row(null, null), "difficulty")).toBe("—");
  });
});
