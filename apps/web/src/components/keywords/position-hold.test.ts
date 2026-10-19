import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { positionHoldLines } from "./position-hold";

function keyword(
  hold: Partial<
    Pick<
      TrackedKeywordItem,
      | "latestPosition"
      | "bestPosition"
      | "positionDeltaFromBest"
      | "daysInTier"
      | "heldTier"
    >
  >,
): TrackedKeywordItem {
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
    ...hold,
  };
}

describe("positionHoldLines", () => {
  it("stays empty without hold facts", () => {
    expect(positionHoldLines(keyword({}))).toEqual([]);
  });

  it("describes a keyword at its best with a held streak", () => {
    expect(
      positionHoldLines(
        keyword({
          latestPosition: 1,
          bestPosition: 1,
          positionDeltaFromBest: 0,
          daysInTier: 12,
          heldTier: 1,
        }),
      ),
    ).toEqual([
      "Best position: 1",
      "At its best position",
      "Held in the top 1 for 12 days",
    ]);
  });

  it("describes a keyword below its best", () => {
    expect(
      positionHoldLines(
        keyword({
          latestPosition: 7,
          bestPosition: 3,
          positionDeltaFromBest: 4,
          daysInTier: 5,
          heldTier: 10,
        }),
      ),
    ).toEqual([
      "Best position: 3",
      "4 places below its best",
      "Held in the top 10 for 5 days",
    ]);
  });

  it("skips the held line when the keyword holds no tier", () => {
    expect(
      positionHoldLines(
        keyword({
          latestPosition: 25,
          bestPosition: 3,
          positionDeltaFromBest: 22,
        }),
      ),
    ).toEqual(["Best position: 3", "22 places below its best"]);
  });

  it("keeps the singular forms for one place and one held day", () => {
    expect(
      positionHoldLines(
        keyword({
          latestPosition: 2,
          bestPosition: 1,
          positionDeltaFromBest: 1,
          daysInTier: 1,
          heldTier: 3,
        }),
      ),
    ).toEqual([
      "Best position: 1",
      "1 place below its best",
      "Held in the top 3 for 1 day",
    ]);
  });
});
