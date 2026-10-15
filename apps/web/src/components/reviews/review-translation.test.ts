import { describe, expect, it } from "vitest";
import type { ReviewItem, ReviewTranslation } from "@asobeast/shared";
import {
  keptTranslation,
  offersTranslation,
  primaryLanguage,
} from "./review-translation";

const TRANSLATION: ReviewTranslation = {
  language: "en",
  sourceLanguage: "de",
  title: null,
  text: "It crashes.",
  translatedAt: "2026-10-15T00:00:00.000Z",
};

const review = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: "rev-1",
  reviewId: "store-rev-1",
  userName: null,
  score: 1,
  title: null,
  text: "Stürzt ab",
  version: null,
  reviewedAt: null,
  ...over,
});

describe("primaryLanguage", () => {
  it("keeps the primary subtag of a browser or model language", () => {
    expect(primaryLanguage("en-US")).toBe("en");
    expect(primaryLanguage("zh_Hant")).toBe("zh");
    expect(primaryLanguage("und")).toBe("und");
    expect(primaryLanguage("")).toBeNull();
    expect(primaryLanguage(null)).toBeNull();
  });
});

describe("offersTranslation", () => {
  it("offers a review whose language differs from the viewer's", () => {
    expect(offersTranslation(review({ language: "de" }), "en", "en")).toBe(
      true,
    );
    expect(offersTranslation(review({ language: "en" }), "en", "de")).toBe(
      false,
    );
  });

  it("falls back to the storefront language when the review's is unknown", () => {
    expect(offersTranslation(review({ language: null }), "en", "de")).toBe(
      true,
    );
    expect(offersTranslation(review({ language: null }), "en", "en")).toBe(
      false,
    );
    expect(offersTranslation(review({ language: null }), "en", null)).toBe(
      false,
    );
  });

  it("trusts the language a translation found over the guess", () => {
    expect(
      offersTranslation(
        review({
          language: "de",
          translation: { ...TRANSLATION, sourceLanguage: "en" },
        }),
        "en",
        "de",
      ),
    ).toBe(false);
  });

  it("offers nothing before the viewer is known or for a review without words", () => {
    expect(offersTranslation(review({ language: "de" }), null, "de")).toBe(
      false,
    );
    expect(
      offersTranslation(review({ language: "de", text: " " }), "en", "de"),
    ).toBe(false);
  });
});

describe("keptTranslation", () => {
  it("answers the kept translation only for the viewer's language", () => {
    const translated = review({ translation: TRANSLATION });

    expect(keptTranslation(translated, "en")).toBe(TRANSLATION);
    expect(keptTranslation(translated, "fr")).toBeNull();
    expect(keptTranslation(translated, null)).toBeNull();
  });
});
