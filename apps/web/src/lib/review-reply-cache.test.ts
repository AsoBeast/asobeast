import { describe, expect, it } from "vitest";
import type { ReviewItem, ReviewList, ReviewReplyItem } from "@asobeast/shared";
import { withReviewReply, withReviewRow } from "./review-reply-cache";

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
  counts: { needsReply: 4, drafted: 1, replied: 2, updated: 0 },
});

describe("withReviewReply", () => {
  it("puts the reply on the row and moves one count to its new state", () => {
    const next = withReviewReply(list([review()]), {}, review(), REPLY);

    expect(next.reviews[0].reply).toEqual(REPLY);
    expect(next.counts).toEqual({
      needsReply: 3,
      drafted: 2,
      replied: 2,
      updated: 0,
    });
  });

  it("moves the count of a row the list does not hold when the filters count it", () => {
    const next = withReviewReply(
      list([]),
      { replyState: "replied" },
      review(),
      REPLY,
    );

    expect(next.counts).toEqual({
      needsReply: 3,
      drafted: 2,
      replied: 2,
      updated: 0,
    });
  });

  it("leaves a list whose star or version filter does not count the row", () => {
    const before = list([]);

    expect(withReviewReply(before, { score: 5 }, review(), REPLY)).toBe(before);
    expect(withReviewReply(before, { version: "2.0.0" }, review(), REPLY)).toBe(
      before,
    );
  });

  it("leaves a list whose period starts after the review was written", () => {
    const before = list([]);

    expect(
      withReviewReply(before, { from: "2026-10-02" }, review(), REPLY),
    ).toBe(before);
    expect(
      withReviewReply(
        before,
        { from: "2026-10-02" },
        review({ reviewedAt: null }),
        REPLY,
      ),
    ).toBe(before);
    expect(
      withReviewReply(before, { from: "2026-10-01" }, review(), REPLY).counts,
    ).toEqual({ needsReply: 3, drafted: 2, replied: 2, updated: 0 });
  });

  it("moves a discarded draft back to needs reply", () => {
    const drafted = review({ reply: REPLY });

    const next = withReviewReply(list([drafted]), {}, drafted, null);

    expect(next.reviews[0].reply).toBeNull();
    expect(next.counts).toEqual({
      needsReply: 5,
      drafted: 0,
      replied: 2,
      updated: 0,
    });
  });

  it("keeps a review edited after the store's reply counted as updated", () => {
    const updated = review({
      reviewedAt: "2026-10-03T00:00:00.000Z",
      repliedAt: ISO,
    });
    const before = {
      ...list([updated]),
      counts: { needsReply: 4, drafted: 1, replied: 2, updated: 1 },
    };

    const next = withReviewReply(before, {}, updated, {
      ...REPLY,
      repliedAt: ISO,
    });

    expect(next.counts).toEqual(before.counts);
  });

  it("keeps the counts of a google play reply the store already shows", () => {
    const replied = review({ repliedAt: ISO });

    const next = withReviewReply(list([replied]), {}, replied, REPLY);

    expect(next.counts).toEqual({
      needsReply: 4,
      drafted: 1,
      replied: 2,
      updated: 0,
    });
  });
});

describe("withReviewRow", () => {
  const posted = review({
    repliedAt: ISO,
    replyText: "Thanks",
    reply: {
      ...REPLY,
      repliedAt: ISO,
      post: {
        postedAt: ISO,
        postedText: "Thanks",
        state: "pending",
        storeResponseId: "response-1",
        postedBy: null,
      },
    },
  });

  it("replaces the row and moves a posted draft to replied", () => {
    const drafted = review({ reply: REPLY });

    const next = withReviewRow(list([drafted]), {}, posted, drafted);

    expect(next.reviews[0]).toBe(posted);
    expect(next.counts).toEqual({
      needsReply: 4,
      drafted: 0,
      replied: 3,
      updated: 0,
    });
  });

  it("moves the count of a row the list does not hold from its previous state", () => {
    const next = withReviewRow(
      list([]),
      { replyState: "drafted" },
      posted,
      review({ reply: REPLY }),
    );

    expect(next.reviews).toEqual([]);
    expect(next.counts).toMatchObject({ drafted: 0, replied: 3 });
  });

  it("leaves a list whose filters do not count the review", () => {
    const before = list([]);

    expect(withReviewRow(before, { score: 5 }, posted)).toBe(before);
  });
});
