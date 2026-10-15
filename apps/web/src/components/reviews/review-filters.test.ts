import { describe, expect, it } from "vitest";
import { QUERY_BOUNDS } from "@asobeast/shared";
import {
  countsFilters,
  REVIEWS_SHOW_ALL_LIMIT,
  reviewFilters,
  type ReviewView,
} from "./review-filters";

const VIEW: ReviewView = {
  score: 1,
  version: "3.4.0",
  replyState: "drafted",
  sort: "lowest",
};

describe("reviewFilters", () => {
  it("leaves out every default so the page and the client share a key", () => {
    expect(
      reviewFilters({
        score: null,
        version: "",
        replyState: null,
        sort: "newest",
      }),
    ).toEqual({
      score: undefined,
      version: undefined,
      replyState: undefined,
      sort: undefined,
      limit: undefined,
    });
  });

  it("carries every filter the view sets", () => {
    expect(reviewFilters(VIEW, REVIEWS_SHOW_ALL_LIMIT)).toEqual({
      score: 1,
      version: "3.4.0",
      replyState: "drafted",
      sort: "lowest",
      limit: QUERY_BOUNDS.reviewsLimit.max,
    });
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
