import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { keywordTotals } from "./keyword-totals";

function keyword(fields: Partial<TrackedKeywordItem> = {}): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text: "focus timer",
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
    ...fields,
  };
}

const at = (latestPosition: number) =>
  keyword({ latestPosition, latestDepth: 200 });
const notFound = () => keyword({ latestPosition: null, latestDepth: 200 });
const neverChecked = () => keyword({ latestPosition: null, latestDepth: null });

describe("keywordTotals", () => {
  it("answers zeros and nulls without rows", () => {
    expect(keywordTotals([])).toEqual({
      count: 0,
      ranked: 0,
      notFound: 0,
      unchecked: 0,
      averagePosition: null,
      topTen: 0,
      averagePopularity: null,
      averageDifficulty: null,
    });
  });

  it("totals a mix of ranked, not found and never checked rows", () => {
    const totals = keywordTotals([
      at(3),
      at(12),
      at(7),
      notFound(),
      neverChecked(),
      at(45),
    ]);

    expect(totals).toMatchObject({
      count: 6,
      ranked: 4,
      notFound: 1,
      unchecked: 1,
      averagePosition: 16.8,
      topTen: 2,
    });
  });

  it("counts position 10 in the top 10 and 11 outside it", () => {
    expect(keywordTotals([at(10), at(11)]).topTen).toBe(1);
  });

  it.each([
    [[1, 2], 1.5],
    [[1, 1, 2], 1.3],
  ])("rounds the average of %j to %s", (positions, expected) => {
    expect(keywordTotals(positions.map(at)).averagePosition).toBe(expected);
  });

  it("does not count a keyword never checked as not found", () => {
    expect(keywordTotals([neverChecked()])).toMatchObject({
      ranked: 0,
      notFound: 0,
      unchecked: 1,
    });
  });

  it("averages the scores the columns show and leaves unscored rows out", () => {
    const totals = keywordTotals([
      keyword({ volume: 40, difficulty: 2 }),
      keyword({ volume: 60, difficulty: 4 }),
      keyword({ volume: null, difficulty: null }),
    ]);

    expect(totals.averagePopularity).toBe(50);
    expect(totals.averageDifficulty).toBe(30);
  });

  it("counts a row with popularity and no difficulty in the popularity only", () => {
    const totals = keywordTotals([
      keyword({ volume: 40, difficulty: 2 }),
      keyword({ volume: 80, difficulty: null }),
    ]);

    expect(totals.averagePopularity).toBe(60);
    expect(totals.averageDifficulty).toBe(20);
  });

  it("answers null averages when no row is scored", () => {
    const totals = keywordTotals([keyword(), keyword()]);

    expect(totals.averagePopularity).toBeNull();
    expect(totals.averageDifficulty).toBeNull();
  });

  it("counts a paused row like any row on screen", () => {
    const totals = keywordTotals([{ ...at(20), active: false }, at(10)]);

    expect(totals).toMatchObject({ count: 2, ranked: 2, averagePosition: 15 });
  });

  it("splits every row into ranked, not found or not checked", () => {
    const totals = keywordTotals([
      at(1),
      notFound(),
      notFound(),
      neverChecked(),
      at(50),
    ]);

    expect(totals.ranked + totals.notFound + totals.unchecked).toBe(
      totals.count,
    );
  });
});
