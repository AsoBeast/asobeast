import { describe, expect, it } from "vitest";
import type { ReviewItem } from "@asobeast/shared";
import { matchesReviewQuery, phraseQuery, quotedPhrase } from "./review-search";

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

  it("matches a quoted phrase on whole words of the title and the text", () => {
    const said = (text: string) => ({ ...REVIEW, title: null, text });
    expect(
      matchesReviewQuery(said("Since the update it lags"), '"update"'),
    ).toBe(true);
    expect(matchesReviewQuery(said("It updated overnight"), '"update"')).toBe(
      false,
    );
    expect(matchesReviewQuery(said("Updates keep failing"), '"update"')).toBe(
      false,
    );
    expect(matchesReviewQuery(said("Dark mode, please"), '"dark mode"')).toBe(
      true,
    );
    expect(
      matchesReviewQuery(said("It is dark. Mode is wrong"), '"dark mode"'),
    ).toBe(false);
    expect(
      matchesReviewQuery(said("The app's timer stops"), '"app timer"'),
    ).toBe(true);
    expect(
      matchesReviewQuery(
        { ...REVIEW, title: "Dark mode please" },
        '"dark mode"',
      ),
    ).toBe(true);
  });

  it("leaves the author, the replies and the translation out of a quoted phrase", () => {
    expect(
      matchesReviewQuery(
        {
          ...REVIEW,
          userName: "update",
          replyText: "Please update",
          reply: {
            text: "The next update fixes it",
            tone: null,
            model: null,
            generatedAt: null,
            updatedAt: "2026-10-01T00:00:00.000Z",
            repliedAt: null,
          },
          translation: {
            language: "en",
            sourceLanguage: "de",
            title: "After the update",
            text: "It crashes.",
            translatedAt: "2026-10-02T00:00:00.000Z",
          },
        },
        '"update"',
      ),
    ).toBe(false);
  });

  it("reads the phrase a theme searches for back from its query", () => {
    expect(quotedPhrase(phraseQuery("dark mode"))).toBe("dark mode");
    expect(quotedPhrase(' "Dark  Mode" ')).toBe("dark mode");
    expect(quotedPhrase(`"app's timer"`)).toBe("app timer");
    expect(quotedPhrase('"dark mode."')).toBe("dark mode");
    expect(quotedPhrase("dark mode")).toBeNull();
    expect(quotedPhrase('"dark mode')).toBeNull();
    expect(quotedPhrase('""')).toBeNull();
  });

  it("searches an unbalanced or empty quote as text", () => {
    expect(matchesReviewQuery(REVIEW, '"crash')).toBe(true);
    expect(matchesReviewQuery(REVIEW, '""')).toBe(true);
  });

  it("matches an emoji only search in the text, the author and the replies", () => {
    const said = (text: string) => ({ ...REVIEW, title: null, text });
    expect(matchesReviewQuery(said("Love it 🎉🎉"), "🎉")).toBe(true);
    expect(matchesReviewQuery(said("Love it"), "🎉")).toBe(false);
    expect(matchesReviewQuery(said("One 🎉 only"), "🎉🎉")).toBe(false);
    expect(matchesReviewQuery(said("Family 👨‍👩‍👧‍👦"), "👨‍👩‍👧‍👦")).toBe(true);
    expect(matchesReviewQuery({ ...REVIEW, userName: "Sam 🎉" }, "🎉")).toBe(
      true,
    );
    expect(
      matchesReviewQuery({ ...REVIEW, replyText: "Thanks 🙏" }, "🙏"),
    ).toBe(true);
  });

  it("searches a quoted emoji as an emoji", () => {
    const said = (text: string) => ({ ...REVIEW, title: null, text });
    expect(matchesReviewQuery(said("Love it 🎉"), '"🎉"')).toBe(true);
    expect(matchesReviewQuery(said("Love it"), '"🎉"')).toBe(false);
  });

  it("requires the emoji of a quoted phrase as well as its words", () => {
    const said = (text: string) => ({ ...REVIEW, title: null, text });
    expect(matchesReviewQuery(said("A 🎉 party today"), '"🎉 party"')).toBe(
      true,
    );
    expect(matchesReviewQuery(said("A party today"), '"🎉 party"')).toBe(false);
    expect(matchesReviewQuery(said("A 🎉 today"), '"🎉 party"')).toBe(false);
  });

  it("lists every review for punctuation only", () => {
    expect(matchesReviewQuery(REVIEW, "(*)")).toBe(true);
    expect(matchesReviewQuery(REVIEW, "\\")).toBe(true);
  });
});
