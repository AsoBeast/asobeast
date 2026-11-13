import { describe, expect, it } from "vitest";
import type { RatingsPoint, ReviewItem, ReviewList } from "@asobeast/shared";
import { reviewsLede } from "./review-lede";

const TODAY = "2026-11-13";

const review = (score: number, reviewedAt: string | null): ReviewItem => ({
  id: `${score}-${reviewedAt}`,
  reviewId: `store-${score}-${reviewedAt}`,
  userName: null,
  score,
  title: null,
  text: "",
  version: null,
  reviewedAt,
});

const list = (
  reviews: ReviewItem[],
  needsReply: number | null = 0,
  total = reviews.length,
): ReviewList => ({
  reviews,
  total,
  versions: [],
  ...(needsReply === null
    ? {}
    : { counts: { needsReply, drafted: 0, replied: 0, updated: 0 } }),
});

const rated = (date: string, ratingAvg: number): RatingsPoint => ({
  date,
  ratingAvg,
  ratingCount: 100,
});

const sentence = (parts: { text: string }[]) =>
  parts.map((part) => part.text).join("");

describe("reviewsLede", () => {
  it("counts the reviews of yesterday and today, the low ones and the queue", () => {
    const parts = reviewsLede({
      list: list(
        [
          review(5, "2026-11-13T08:00:00.000Z"),
          review(2, "2026-11-12T00:00:00.000Z"),
          review(1, "2026-11-11T23:59:59.000Z"),
        ],
        3,
      ),
      points: [rated("2026-11-06", 4.7), rated("2026-11-13", 4.65)],
      today: TODAY,
    });

    expect(sentence(parts)).toBe(
      "2 new reviews since yesterday, 1 at two stars or less. 3 need a reply. Rating 4.7, down 0.05 over 7 days.",
    );
    expect(
      parts.filter((part) => part.strong).map((part) => part.text),
    ).toEqual(["2 new reviews", " 3 need a reply."]);
  });

  it("says a single review and a single reply in the singular", () => {
    expect(
      sentence(
        reviewsLede({
          list: list([review(4, "2026-11-12T10:00:00.000Z")], 1),
          points: [],
          today: TODAY,
        }),
      ),
    ).toBe("1 new review since yesterday. 1 needs a reply.");
  });

  it("reads or more when the whole first page is new and another page exists", () => {
    const page = Array.from({ length: 50 }, () =>
      review(5, "2026-11-13T01:00:00.000Z"),
    );

    expect(
      sentence(
        reviewsLede({ list: list(page, 0, 60), points: [], today: TODAY }),
      ),
    ).toBe("50 or more new reviews since yesterday. Nothing needs a reply.");
  });

  it("says when nothing arrived and leaves the queue out without counts", () => {
    expect(
      sentence(
        reviewsLede({
          list: list(
            [review(3, "2026-11-01T00:00:00.000Z"), review(3, null)],
            null,
          ),
          points: [rated("2026-11-13", 4.2)],
          today: TODAY,
        }),
      ),
    ).toBe("No new reviews since yesterday. Rating 4.2.");
  });

  it("names a rating that rose and one that held", () => {
    const quiet = list([review(5, "2026-10-01T00:00:00.000Z")]);

    expect(
      sentence(
        reviewsLede({
          list: quiet,
          points: [rated("2026-11-06", 4.5), rated("2026-11-13", 4.62)],
          today: TODAY,
        }),
      ),
    ).toContain("Rating 4.6, up 0.12 over 7 days.");
    expect(
      sentence(
        reviewsLede({
          list: quiet,
          points: [rated("2026-11-06", 4.5), rated("2026-11-13", 4.501)],
          today: TODAY,
        }),
      ),
    ).toContain("Rating 4.5, unchanged over 7 days.");
  });

  it("says what is missing for an app with nothing stored", () => {
    expect(
      sentence(reviewsLede({ list: list([]), points: [], today: TODAY })),
    ).toBe(
      "No reviews or ratings are stored yet. They are read on the daily run.",
    );
    expect(
      sentence(
        reviewsLede({
          list: list([]),
          points: [rated("2026-11-13", 4.8)],
          today: TODAY,
        }),
      ),
    ).toBe("No reviews are stored yet. Rating 4.8.");
  });
});
