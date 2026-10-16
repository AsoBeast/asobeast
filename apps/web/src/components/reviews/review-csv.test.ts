import { describe, expect, it } from "vitest";
import type { ReviewItem } from "@asobeast/shared";
import { reviewCsv, truncatedExportNotice } from "./review-csv";

const reviewedAt = new Date().toISOString();

function review(over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: "rev-1",
    reviewId: "store-rev-1",
    userName: "Casey",
    score: 5,
    title: "Love the focus timer",
    text: "Best pomodoro app I have used.",
    version: "3.4.1",
    reviewedAt,
    ...over,
  };
}

const lines = (reviews: ReviewItem[]) => reviewCsv(reviews).split("\r\n");

describe("reviewCsv", () => {
  it("heads the file with the review columns in order", () => {
    expect(lines([])[0]).toBe(
      "﻿reviewedAt,score,title,text,version,author,reviewId,replyState,replyText",
    );
  });

  it("neutralizes a formula-like title and quotes a multi line text", () => {
    const csv = reviewCsv([
      review({
        title: "=HYPERLINK(1)",
        text: "-2 stars, crashes\nevery time",
      }),
    ]);
    expect(csv).toContain(",'=HYPERLINK(1),");
    expect(csv).toContain(`,"'-2 stars, crashes\nevery time",`);
  });

  it("writes the score as a number, the author and the store review id", () => {
    expect(lines([review()])[1]).toBe(
      `${reviewedAt},5,Love the focus timer,Best pomodoro app I have used.,3.4.1,Casey,store-rev-1,needs_reply,`,
    );
  });

  it("leaves the fields a store did not send empty", () => {
    expect(
      lines([
        review({
          title: null,
          version: null,
          userName: null,
          reviewedAt: null,
        }),
      ])[1],
    ).toBe(",5,,Best pomodoro app I have used.,,,store-rev-1,needs_reply,");
  });

  it("writes the reply state and the owner's or the store's reply text", () => {
    const reply = {
      text: "Sorry about that",
      tone: null,
      model: null,
      generatedAt: null,
      updatedAt: reviewedAt,
      repliedAt: null,
    };
    const tail = (item: ReviewItem) => lines([item])[1].split(",").slice(-2);

    expect(tail(review({ reply }))).toEqual(["drafted", "Sorry about that"]);
    expect(
      tail(review({ repliedAt: reviewedAt, replyText: "Fixed in 2.1" })),
    ).toEqual(["replied", "Fixed in 2.1"]);
    expect(tail(review())).toEqual(["needs_reply", ""]);
    expect(
      tail(
        review({
          repliedAt: reviewedAt,
          replyText: "Fixed in 2.1",
          reply: { ...reply, text: "", repliedAt: reviewedAt },
        }),
      ),
    ).toEqual(["replied", "Fixed in 2.1"]);
  });
});

describe("truncatedExportNotice", () => {
  it("says how many reviews a search found among the loaded ones", () => {
    const loaded = { reviews: [review(), review()], total: 450 };

    expect(truncatedExportNotice(loaded, "newest", 1)).toBe(
      "Exported 1 review found in the newest 2 of 450. Narrow the filters to search the others.",
    );
    expect(truncatedExportNotice(loaded, "newest", 2)).toBe(
      "Exported 2 reviews found in the newest 2 of 450. Narrow the filters to search the others.",
    );
  });

  it("names the order of a lowest first searched export", () => {
    expect(
      truncatedExportNotice(
        { reviews: [review(), review()], total: 1800 },
        "lowest",
        1,
      ),
    ).toBe(
      "Exported 1 review found in the lowest scored 2 of 1,800. Narrow the filters to search the others.",
    );
  });

  it("stays quiet when the search covered every matching review", () => {
    expect(
      truncatedExportNotice(
        { reviews: [review(), review()], total: 2 },
        "newest",
        1,
      ),
    ).toBeNull();
  });

  it("says how many of the matching reviews the file holds when it stops short", () => {
    expect(
      truncatedExportNotice({ reviews: [review(), review()], total: 1800 }),
    ).toBe(
      "Exported the newest 2 of 1,800 reviews. Narrow the filters to reach the others.",
    );
  });

  it("names the order of a lowest first export", () => {
    expect(
      truncatedExportNotice(
        { reviews: [review(), review()], total: 1800 },
        "lowest",
      ),
    ).toBe(
      "Exported the lowest scored 2 of 1,800 reviews. Narrow the filters to reach the others.",
    );
  });

  it("stays quiet when every matching review is in the file", () => {
    expect(truncatedExportNotice({ reviews: [review()], total: 1 })).toBeNull();
  });
});
