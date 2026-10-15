import { describe, expect, it } from "vitest";
import type { ReviewItem, ReviewList, ReviewReplyItem } from "@asobeast/shared";
import { withReviewReply } from "./review-reply-cache";

const ISO = "2026-10-01T00:00:00.000Z";
const REPLY: ReviewReplyItem = {
  text: "Thanks",
  tone: null,
  model: null,
  generatedAt: null,
  updatedAt: ISO,
  repliedAt: null,
};

const review = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: "rev-1",
  reviewId: "store-rev-1",
  userName: null,
  score: 1,
  title: null,
  text: "Broken",
  version: "1.0.0",
  reviewedAt: ISO,
  repliedAt: null,
  replyText: null,
  reply: null,
  ...over,
});

const list = (reviews: ReviewItem[]): ReviewList => ({
  reviews,
  total: reviews.length,
  versions: ["1.0.0"],
  counts: { needsReply: 4, drafted: 1, replied: 2 },
});

describe("withReviewReply", () => {
  it("puts the reply on the row and moves one count to its new state", () => {
    const next = withReviewReply(list([review()]), {}, review(), REPLY);

    expect(next.reviews[0].reply).toEqual(REPLY);
    expect(next.counts).toEqual({ needsReply: 3, drafted: 2, replied: 2 });
  });

  it("moves the count of a row the list does not hold when the filters count it", () => {
    const next = withReviewReply(
      list([]),
      { replyState: "replied" },
      review(),
      REPLY,
    );

    expect(next.counts).toEqual({ needsReply: 3, drafted: 2, replied: 2 });
  });

  it("leaves a list whose star or version filter does not count the row", () => {
    const before = list([]);

    expect(withReviewReply(before, { score: 5 }, review(), REPLY)).toBe(before);
    expect(withReviewReply(before, { version: "2.0.0" }, review(), REPLY)).toBe(
      before,
    );
  });

  it("moves a discarded draft back to needs reply", () => {
    const drafted = review({ reply: REPLY });

    const next = withReviewReply(list([drafted]), {}, drafted, null);

    expect(next.reviews[0].reply).toBeNull();
    expect(next.counts).toEqual({ needsReply: 5, drafted: 0, replied: 2 });
  });

  it("keeps the counts of a google play reply the store already shows", () => {
    const replied = review({ repliedAt: ISO });

    const next = withReviewReply(list([replied]), {}, replied, REPLY);

    expect(next.counts).toEqual({ needsReply: 4, drafted: 1, replied: 2 });
  });
});
