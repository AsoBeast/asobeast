import { describe, expect, it } from "vitest";
import type { RankDistribution } from "@asobeast/shared";
import { bandCounts, bandSegments, bandSummary } from "./rank-bands";

const DISTRIBUTION: RankDistribution = {
  top1: 1,
  top3: 2,
  top10: 4,
  top50: 5,
  beyond: 0,
  unranked: 2,
};

describe("bandCounts", () => {
  it("turns cumulative buckets into disjoint bands", () => {
    expect(bandCounts(DISTRIBUTION)).toEqual({
      rank1: 1,
      rank2to3: 1,
      rank4to10: 2,
      rank11to50: 1,
      rank51plus: 0,
      unranked: 2,
    });
  });

  it("adds up to every tracked keyword", () => {
    const counts = Object.values(bandCounts(DISTRIBUTION));
    const tracked =
      DISTRIBUTION.top50 + DISTRIBUTION.beyond + DISTRIBUTION.unranked;

    expect(counts.reduce((total, count) => total + count, 0)).toBe(tracked);
  });
});

describe("bandSegments", () => {
  it("drops empty bands and shares the whole bar", () => {
    const segments = bandSegments(DISTRIBUTION);

    expect(segments.map((segment) => segment.key)).toEqual([
      "rank1",
      "rank2to3",
      "rank4to10",
      "rank11to50",
      "unranked",
    ]);
    expect(
      segments.reduce((total, segment) => total + segment.share, 0),
    ).toBeCloseTo(1);
  });

  it("draws nothing without tracked keywords", () => {
    expect(
      bandSegments({
        top1: 0,
        top3: 0,
        top10: 0,
        top50: 0,
        beyond: 0,
        unranked: 0,
      }),
    ).toEqual([]);
  });
});

describe("bandSummary", () => {
  it("states every band as a sentence", () => {
    expect(bandSummary({ ...DISTRIBUTION, unranked: 0 })).toBe(
      "Rank bands: 1 at #1, 1 at #2–3, 2 at #4–10, 1 at #11–50, 0 at #51+, 0 unranked",
    );
  });
});
