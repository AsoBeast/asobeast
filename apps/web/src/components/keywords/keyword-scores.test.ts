import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  hasFloorAnswer,
  isScoreOutdated,
  scorePair,
  scoreValue,
} from "./keyword-scores";

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

describe("isScoreOutdated", () => {
  it.each([
    [{ scoreOutdated: true }, true],
    [{ scoreOutdated: false }, false],
    [{}, false],
    [{ scoreOutdated: undefined, volume: null }, false],
  ])("%j is outdated: %s", (scores, expected) => {
    expect(isScoreOutdated(keyword(scores))).toBe(expected);
  });
});

describe("hasFloorAnswer", () => {
  const signals = {
    suggestReach: "hit" as const,
    suggestPrefixLength: 2,
    suggestPosition: 1,
    serpRelevance: 0.8,
    medianRatingCount: 1200,
    flags: [],
    officialPopularity: null,
    estimatedTraffic: 4,
  };

  it.each([
    ["floor", true],
    ["absent", true],
    ["listed", false],
  ] as const)("reads a %s answer as a floor answer: %s", (state, expected) => {
    expect(
      hasFloorAnswer(
        keyword({
          scoreSignals: { ...signals, officialPopularityState: state },
        }),
      ),
    ).toBe(expected);
  });

  it("reads no floor answer without signals", () => {
    expect(hasFloorAnswer(keyword({ scoreSignals: null }))).toBe(false);
    expect(hasFloorAnswer(keyword({}))).toBe(false);
  });
});

describe("scorePair", () => {
  it.each<[Partial<TrackedKeywordItem>, ReturnType<typeof scorePair>]>([
    [
      { volume: 62, difficulty: 1.8 },
      { popularity: 62, difficulty: 18 },
    ],
    [
      { volume: 19.5, difficulty: 2.54 },
      { popularity: 20, difficulty: 25 },
    ],
    [
      { volume: 5000, difficulty: 2 },
      { popularity: 100, difficulty: 20 },
    ],
    [{ volume: null, difficulty: 2 }, null],
    [{ volume: 40, difficulty: null }, null],
  ])("reads %j as %j", (scores, expected) => {
    expect(scorePair(keyword(scores))).toEqual(expected);
  });
});
