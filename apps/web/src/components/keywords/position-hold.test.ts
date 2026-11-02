import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { positionHoldFacts } from "./position-hold";

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

describe("positionHoldFacts", () => {
  it("stays empty without hold facts", () => {
    expect(positionHoldFacts(keyword({}))).toEqual([]);
  });

  it("describes a keyword at its best with a held streak", () => {
    expect(
      positionHoldFacts(
        keyword({
          latestPosition: 1,
          bestPosition: 1,
          positionDeltaFromBest: 0,
          daysInTier: 12,
          heldTier: 1,
        }),
      ),
    ).toEqual([
      { label: "Best", value: "#1" },
      { label: "From best", value: "At its best" },
      { label: "Held", value: "Top 1 for 12 days" },
    ]);
  });

  it("describes a keyword below its best", () => {
    expect(
      positionHoldFacts(
        keyword({
          latestPosition: 7,
          bestPosition: 3,
          positionDeltaFromBest: 4,
          daysInTier: 5,
          heldTier: 10,
        }),
      ),
    ).toEqual([
      { label: "Best", value: "#3" },
      { label: "From best", value: "4 places below" },
      { label: "Held", value: "Top 10 for 5 days" },
    ]);
  });

  it("leaves the held fact out when the keyword holds no tier", () => {
    expect(
      positionHoldFacts(
        keyword({
          latestPosition: 25,
          bestPosition: 3,
          positionDeltaFromBest: 22,
        }),
      ),
    ).toEqual([
      { label: "Best", value: "#3" },
      { label: "From best", value: "22 places below" },
    ]);
  });

  it("keeps the singular forms for one place and one held day", () => {
    expect(
      positionHoldFacts(
        keyword({
          latestPosition: 2,
          bestPosition: 1,
          positionDeltaFromBest: 1,
          daysInTier: 1,
          heldTier: 3,
        }),
      ),
    ).toEqual([
      { label: "Best", value: "#1" },
      { label: "From best", value: "1 place below" },
      { label: "Held", value: "Top 3 for 1 day" },
    ]);
  });
});
