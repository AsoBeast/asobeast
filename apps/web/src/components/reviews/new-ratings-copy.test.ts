import { describe, expect, it } from "vitest";
import { newRatingsParts, tooFewNewRatings } from "./new-ratings-copy";

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

describe("tooFewNewRatings", () => {
  it("says when there are too few new ratings", () => {
    expect(tooFewNewRatings(90)).toBe(
      "Too few new ratings over 90 days to work out their average.",
    );
  });
});
