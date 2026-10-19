import { describe, expect, it } from "vitest";
import { themesSummary } from "./review-themes-summary";

const OPTIONS = { negativeScoreMax: 2, reviews: 200, sort: "newest" } as const;

describe("themesSummary", () => {
  it("compares with the newest 500 reviews of the version and period", () => {
    expect(themesSummary(OPTIONS)).toContain(
      "compared with the newest 500 reviews of the version and period.",
    );
  });

  it("says the counts cover the newest reviews in the default order", () => {
    expect(themesSummary(OPTIONS)).toContain(
      "Counts cover the 200 newest reviews matching the filters.",
    );
  });

  it("says the counts cover the lowest rated reviews when the list sorts lowest first", () => {
    expect(themesSummary({ ...OPTIONS, sort: "lowest" })).toContain(
      "Counts cover the 200 lowest rated reviews matching the filters.",
    );
  });

  it("counts the reviews the answer covers, not the cap", () => {
    expect(themesSummary({ ...OPTIONS, reviews: 5 })).toContain(
      "Counts cover the 5 newest reviews matching",
    );
    expect(themesSummary({ ...OPTIONS, reviews: 1, sort: "lowest" })).toContain(
      "Counts cover the 1 lowest rated review matching",
    );
  });

  it("names the star rating that makes a review a complaint", () => {
    expect(themesSummary({ ...OPTIONS, negativeScoreMax: 1 })).toContain(
      "reviews at 1 star or less",
    );
    expect(themesSummary(OPTIONS)).toContain("reviews at 2 stars or less");
  });

  it("never claims to compare with every review", () => {
    expect(themesSummary(OPTIONS)).not.toContain("every review");
  });
});
