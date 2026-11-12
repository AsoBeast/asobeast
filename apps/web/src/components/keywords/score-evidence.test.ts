import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  difficultyEvidence,
  opportunityEvidence,
  popularityEvidence,
} from "./score-evidence";

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

describe("score evidence", () => {
  it("names each score with the value the table shows", () => {
    const row = keyword({ volume: 64, difficulty: 4.1, opportunity: 82 });

    expect(popularityEvidence(row)).toMatchObject({
      label: "Popularity",
      metric: "popularity",
      value: 64,
    });
    expect(difficultyEvidence(row)).toMatchObject({
      label: "Difficulty",
      metric: "difficulty",
      value: 41,
    });
    expect(opportunityEvidence(row)).toMatchObject({
      label: "Opportunity",
      metric: "opportunity",
      value: 82,
      emphasize: true,
    });
  });

  it("keeps an unscored keyword without values", () => {
    const row = keyword({});

    expect(popularityEvidence(row).value).toBeNull();
    expect(difficultyEvidence(row).value).toBeNull();
    expect(opportunityEvidence(row).value).toBeNull();
    expect(popularityEvidence(row).provenance).toBeNull();
  });
});
