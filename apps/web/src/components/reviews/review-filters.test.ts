import { describe, expect, it } from "vitest";
import { QUERY_BOUNDS } from "@asobeast/shared";
import { presetToRange } from "@/lib/ranges";
import {
  countsFilters,
  narrowsReviews,
  REVIEWS_SHOW_ALL_LIMIT,
  reviewFilters,
  type ReviewView,
} from "./review-filters";

const VIEW: ReviewView = {
  score: 1,
  version: "3.4.0",
  since: null,
  replyState: "drafted",
  sort: "lowest",
};

describe("reviewFilters", () => {
  it("leaves out every default so the page and the client share a key", () => {
    expect(
      reviewFilters({
        score: null,
        version: "",
        since: null,
        replyState: null,
        sort: "newest",
      }),
    ).toEqual({
      score: undefined,
      version: undefined,
      from: undefined,
      replyState: undefined,
      sort: undefined,
      limit: undefined,
    });
  });

  it("carries every filter the view sets", () => {
    expect(reviewFilters(VIEW, REVIEWS_SHOW_ALL_LIMIT)).toEqual({
      score: 1,
      version: "3.4.0",
      from: undefined,
      replyState: "drafted",
      sort: "lowest",
      limit: QUERY_BOUNDS.reviewsLimit.max,
    });
  });

  it("turns a since preset into the first day it covers", () => {
    expect(reviewFilters({ ...VIEW, since: "90d" }).from).toBe(
      presetToRange("90d").from,
    );
  });
});

describe("narrowsReviews", () => {
  it("counts a star, a version or a period as narrowing and ignores the state", () => {
    const open = { ...VIEW, score: null, version: "", replyState: null };

    expect(narrowsReviews(open)).toBe(false);
    expect(narrowsReviews({ ...open, replyState: "replied" })).toBe(false);
    expect(narrowsReviews({ ...open, since: "30d" })).toBe(true);
    expect(narrowsReviews({ ...open, version: "3.4.0" })).toBe(true);
  });
});

describe("countsFilters", () => {
  it("keeps the star and version filters and drops the state and the sort", () => {
    expect(countsFilters(VIEW)).toEqual(
      reviewFilters({ ...VIEW, replyState: null, sort: "newest" }),
    );
    expect(countsFilters(VIEW)).toEqual(
      countsFilters({ ...VIEW, sort: "newest", replyState: "replied" }),
    );
  });
});
