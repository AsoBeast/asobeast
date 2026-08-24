import { describe, expect, it } from "vitest";
import { RANK_DEPTH, type TrackedKeywordItem } from "@asobeast/shared";
import { keywordCsv } from "./keyword-csv";

function keyword(text: string): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text,
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: RANK_DEPTH,
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
  };
}

describe("keywordCsv", () => {
  it("neutralizes a formula-like keyword through the shared escaper", () => {
    expect(keywordCsv([keyword("=cmd|'/c calc'!A1")])).toContain(
      "'=cmd|'/c calc'!A1",
    );
  });

  it("renders a checked but unranked position at the captured depth", () => {
    expect(keywordCsv([keyword("focus timer")])).toContain(
      `focus timer,MANUAL,true,>${RANK_DEPTH},`,
    );
  });
});
