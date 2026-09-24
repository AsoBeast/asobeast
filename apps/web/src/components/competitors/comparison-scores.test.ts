import { describe, expect, it } from "vitest";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { comparisonScore } from "./comparison-scores";

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

describe("comparisonScore", () => {
  it.each([
    [0, "0"],
    [4.1, "41"],
    [10, "100"],
    [10.0001, "100"],
    [48.2, "100"],
    [-1, "0"],
  ])("labels a stored score of %s as %s", (score, expected) => {
    expect(comparisonScore(row(score, null), "traffic").label).toBe(expected);
    expect(comparisonScore(row(null, score), "difficulty").label).toBe(
      expected,
    );
  });

  it.each([
    [6.2, "strong", "weak"],
    [4.5, "fair", "fair"],
    [1.5, "poor", "strong"],
  ] as const)(
    "grades a stored score of %s as %s popularity and %s difficulty",
    (score, popularity, difficulty) => {
      expect(comparisonScore(row(score, null), "traffic").grade).toBe(
        popularity,
      );
      expect(comparisonScore(row(null, score), "difficulty").grade).toBe(
        difficulty,
      );
    },
  );

  it("labels an unscored keyword with an em dash and no grade", () => {
    expect(comparisonScore(row(null, null), "traffic")).toEqual({
      label: "—",
      grade: null,
    });
    expect(comparisonScore(row(null, null), "difficulty")).toEqual({
      label: "—",
      grade: null,
    });
  });
});
