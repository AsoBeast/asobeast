import { describe, expect, it } from "vitest";
import { reviewActionLabel, reviewSubject } from "./review-subject";

const jordan = {
  score: 2,
  userName: "Jordan",
  reviewedAt: "2026-10-03T12:00:00.000Z",
};

describe("reviewSubject", () => {
  it("names a review by its stars, its author and its day", () => {
    expect(reviewSubject(jordan)).toBe(
      "2 star review by Jordan on Oct 3, 2026",
    );
  });

  it("calls a review without an author anonymous, as the card does", () => {
    expect(reviewSubject({ ...jordan, userName: null })).toBe(
      "2 star review by Anonymous on Oct 3, 2026",
    );
  });

  it("leaves the day out when the store sent none", () => {
    expect(reviewSubject({ ...jordan, reviewedAt: null })).toBe(
      "2 star review by Jordan",
    );
  });
});

describe("reviewActionLabel", () => {
  it("starts with the action so the visible text is part of the name", () => {
    expect(reviewActionLabel("Reply to", jordan)).toBe(
      "Reply to the 2 star review by Jordan on Oct 3, 2026",
    );
  });
});
