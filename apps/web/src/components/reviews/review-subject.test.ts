import { describe, expect, it } from "vitest";
import type { ReviewItem } from "@asobeast/shared";
import {
  reviewActionLabel,
  reviewSubject,
  reviewTwins,
} from "./review-subject";

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

type Subject = Pick<ReviewItem, "score" | "userName" | "reviewedAt">;

const googleUser: Subject = {
  score: 1,
  userName: "A Google user",
  reviewedAt: "2026-10-12T12:00:00.000Z",
};

const review = (id: string, fields: Partial<Subject> = {}) => ({
  id,
  ...googleUser,
  ...fields,
});

describe("reviewSubject with a twin", () => {
  it("adds the position among reviews that share the name", () => {
    expect(reviewSubject(googleUser, { rank: 2, of: 3 })).toBe(
      "1 star review by A Google user on Oct 12, 2026 (2 of 3)",
    );
  });
});

describe("reviewActionLabel with a twin", () => {
  it("keeps the action first and puts the position last", () => {
    expect(reviewActionLabel("Reply to", googleUser, { rank: 1, of: 2 })).toBe(
      "Reply to the 1 star review by A Google user on Oct 12, 2026 (1 of 2)",
    );
  });
});

describe("reviewTwins", () => {
  it("numbers reviews that share stars, author and day in list order", () => {
    const twins = reviewTwins([review("a"), review("b"), review("c")]);

    expect(twins.get("a")).toEqual({ rank: 1, of: 3 });
    expect(twins.get("b")).toEqual({ rank: 2, of: 3 });
    expect(twins.get("c")).toEqual({ rank: 3, of: 3 });
  });

  it("leaves a review without a twin out", () => {
    const twins = reviewTwins([
      review("a"),
      review("b", { userName: "Casey" }),
      review("c", { score: 5 }),
      review("d", { reviewedAt: "2026-10-13T12:00:00.000Z" }),
    ]);

    expect(twins.size).toBe(0);
  });

  it("treats the time of day as the same day", () => {
    const twins = reviewTwins([
      review("a", { reviewedAt: "2026-10-12T00:00:01.000Z" }),
      review("b", { reviewedAt: "2026-10-12T23:59:59.000Z" }),
    ]);

    expect(twins.get("b")).toEqual({ rank: 2, of: 2 });
  });

  it("reads a missing author as the anonymous one the card shows", () => {
    const twins = reviewTwins([
      review("a", { userName: null }),
      review("b", { userName: null }),
    ]);

    expect(twins.get("a")).toEqual({ rank: 1, of: 2 });
  });

  it("counts separately for each group of twins", () => {
    const twins = reviewTwins([
      review("a"),
      review("x", { userName: "Casey" }),
      review("b"),
      review("y", { userName: "Casey" }),
    ]);

    expect(twins.get("b")).toEqual({ rank: 2, of: 2 });
    expect(twins.get("y")).toEqual({ rank: 2, of: 2 });
  });

  it("gives every name in a list a different text", () => {
    const list = [review("a"), review("b"), review("c", { userName: "Casey" })];
    const twins = reviewTwins(list);
    const names = list.map((item) => reviewSubject(item, twins.get(item.id)));

    expect(new Set(names).size).toBe(list.length);
  });
});
