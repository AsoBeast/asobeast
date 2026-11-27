import { describe, expect, it } from "vitest";
import {
  benchmarkParts,
  newRatingsParts,
  tooFewCompetitors,
  tooFewNewRatings,
} from "./new-ratings-copy";

describe("newRatingsParts", () => {
  it("compares the new ratings average with the overall one", () => {
    expect(newRatingsParts(4.7, 4.3, 30)).toEqual([
      "New ratings average",
      4.7,
      "over 30 days, above your overall",
      4.3,
    ]);
    expect(newRatingsParts(4.1, 4.3, 30)[2]).toBe(
      "over 30 days, below your overall",
    );
    expect(newRatingsParts(4.32, 4.28, 90)[2]).toBe(
      "over 90 days, level with your overall",
    );
  });
});

describe("the comparison word", () => {
  it("compares the figures as the sentence shows them", () => {
    expect(newRatingsParts(4.35, 4.34, 30)[2]).toBe(
      "over 30 days, level with your overall",
    );
  });
});

describe("tooFewNewRatings", () => {
  it("says when there are too few new ratings", () => {
    expect(tooFewNewRatings(90)).toBe(
      "Too few new ratings over 90 days to work out their average.",
    );
  });
});

describe("benchmarkParts", () => {
  it("compares the median with the own figure", () => {
    expect(benchmarkParts(4.4, 5, 30, 4.7)).toEqual([
      "Your tracked competitors' new ratings average",
      4.4,
      "over 30 days (median of 5), below yours",
    ]);
  });

  it("says above", () => {
    expect(benchmarkParts(4.8, 3, 90, 4.4)[2]).toBe(
      "over 90 days (median of 3), above yours",
    );
  });

  it("compares the figures as they are shown", () => {
    expect(benchmarkParts(4.35, 4, 30, 4.34)[2]).toBe(
      "over 30 days (median of 4), level with yours",
    );
  });

  it("leaves the comparison out without an own figure", () => {
    expect(benchmarkParts(4.4, 5, 30, null)[2]).toBe(
      "over 30 days (median of 5)",
    );
  });
});

describe("tooFewCompetitors", () => {
  it("says that fewer than three can be compared", () => {
    expect(tooFewCompetitors).toBe(
      "Fewer than three of your tracked competitors have enough new ratings to compare.",
    );
  });
});
