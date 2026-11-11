import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { nearTopTen } from "./near-top-ten";

function keyword(fields: Partial<TrackedKeywordItem> = {}): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text: "focus timer",
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: 200,
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
    ...fields,
  };
}

const at = (keywordId: string, latestPosition: number | null, volume = 0) =>
  keyword({ keywordId, latestPosition, volume });

describe("nearTopTen", () => {
  it("keeps the keywords ranked from 11 to 20, closest first", () => {
    const near = nearTopTen(
      [at("a", 20), at("b", 10), at("c", 11), at("d", 21), at("e", 14)],
      5,
    );

    expect(
      near.map(({ keywordId, position, away }) => [keywordId, position, away]),
    ).toEqual([
      ["c", 11, 1],
      ["e", 14, 4],
      ["a", 20, 10],
    ]);
  });

  it("puts the more searched keyword first at the same position", () => {
    const near = nearTopTen([at("quiet", 12, 5), at("busy", 12, 60)], 5);

    expect(near.map((entry) => entry.keywordId)).toEqual(["busy", "quiet"]);
  });

  it("leaves out paused, unranked and unchecked keywords", () => {
    const near = nearTopTen(
      [
        keyword({ keywordId: "paused", latestPosition: 12, active: false }),
        at("unranked", null),
        keyword({ keywordId: "unchecked", latestDepth: null }),
      ],
      5,
    );

    expect(near).toEqual([]);
  });

  it("stops at the limit", () => {
    const near = nearTopTen([at("a", 11), at("b", 12), at("c", 13)], 2);

    expect(near.map((entry) => entry.keywordId)).toEqual(["a", "b"]);
  });
});
