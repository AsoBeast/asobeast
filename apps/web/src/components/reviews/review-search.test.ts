import { describe, expect, it } from "vitest";
import type { ReviewItem } from "@asobeast/shared";
import { matchesReviewQuery } from "./review-search";

const REVIEW: ReviewItem = {
  id: "rev-1",
  reviewId: "store-rev-1",
  userName: "Jordan",
  score: 2,
  title: "Stürzt ab",
  text: "It crashes when I start a session.",
  version: "3.4.0",
  reviewedAt: "2026-10-01T00:00:00.000Z",
  repliedAt: null,
  replyText: null,
  reply: null,
};

describe("matchesReviewQuery", () => {
  it("matches the title, the text and the author, ignoring case and accents", () => {
    expect(matchesReviewQuery(REVIEW, "CRASH")).toBe(true);
    expect(matchesReviewQuery(REVIEW, "jordan")).toBe(true);
    expect(matchesReviewQuery(REVIEW, "sturzt")).toBe(true);
    expect(matchesReviewQuery(REVIEW, "stürzt")).toBe(true);
    expect(matchesReviewQuery(REVIEW, "dark mode")).toBe(false);
  });

  it("matches the kept translation", () => {
    expect(
      matchesReviewQuery(
        {
          ...REVIEW,
          translation: {
            language: "en",
            sourceLanguage: "de",
            title: "Crashes on start",
            text: "The app closes.",
            translatedAt: "2026-10-02T00:00:00.000Z",
          },
        },
        "closes",
      ),
    ).toBe(true);
  });

  it("matches the developer reply text on google play", () => {
    expect(
      matchesReviewQuery(
        { ...REVIEW, replyText: "Version 2.8.0 behebt den Absturz" },
        "absturz",
      ),
    ).toBe(true);
  });

  it("matches the owner's reply text", () => {
    expect(
      matchesReviewQuery(
        {
          ...REVIEW,
          reply: {
            text: "Sorry about that",
            tone: null,
            model: null,
            generatedAt: null,
            updatedAt: "2026-10-01T00:00:00.000Z",
            repliedAt: null,
          },
        },
        "sorry",
      ),
    ).toBe(true);
  });

  it("answers every review for an empty query", () => {
    expect(matchesReviewQuery(REVIEW, "")).toBe(true);
  });
});
