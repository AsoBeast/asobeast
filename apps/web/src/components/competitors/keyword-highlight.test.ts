import { describe, expect, it } from "vitest";
import { highlightTerms, matchLabel, matchStrength } from "./keyword-highlight";

describe("highlightTerms", () => {
  it("marks the words that are keyword terms and keeps the rest verbatim", () => {
    expect(highlightTerms("Focus Timer: Pomodoro", ["focus", "timer"])).toEqual(
      [
        { text: "Focus", match: true },
        { text: " ", match: false },
        { text: "Timer", match: true },
        { text: ": ", match: false },
        { text: "Pomodoro", match: false },
      ],
    );
  });

  it("does not mark a term inside a longer word", () => {
    expect(highlightTerms("Timers", ["timer"]).some((part) => part.match)).toBe(
      false,
    );
  });

  it("rebuilds the original text from its parts", () => {
    const value = "Étude – Fokus & Zeit!";
    expect(
      highlightTerms(value, ["fokus"])
        .map((part) => part.text)
        .join(""),
    ).toBe(value);
  });
});

describe("highlightTerms with accents", () => {
  it("marks a word that differs from the term only by its accents", () => {
    expect(
      highlightTerms("Mes Pays Visites", ["pays", "visités"])
        .filter((part) => part.match)
        .map((part) => part.text),
    ).toEqual(["Pays", "Visites"]);
  });
});

describe("matchStrength", () => {
  it("ranks a phrase over single words over nothing", () => {
    expect(matchStrength({ phrase: true, terms: ["a", "b"] })).toBe("phrase");
    expect(matchStrength({ phrase: false, terms: ["a"] })).toBe("partial");
    expect(matchStrength({ phrase: false, terms: [] })).toBe("none");
  });
});

describe("matchLabel", () => {
  it("names the match for a keyword of several words", () => {
    expect(matchLabel({ phrase: true, terms: ["a", "b"] }, 2)).toBe(
      "Exact phrase",
    );
    expect(matchLabel({ phrase: false, terms: ["a"] }, 3)).toBe("1 of 3 words");
    expect(matchLabel({ phrase: false, terms: [] }, 3)).toBe("No match");
  });

  it("says when the phrase only matches without its accents", () => {
    expect(
      matchLabel(
        { phrase: true, terms: ["pays", "visités"], looseTerms: ["visités"] },
        2,
      ),
    ).toBe("Phrase, accents differ");
    expect(
      matchLabel({ phrase: true, terms: ["café"], looseTerms: ["café"] }, 1),
    ).toBe("Match, accents differ");
  });

  it("calls a single word keyword a match", () => {
    expect(matchLabel({ phrase: true, terms: ["a"] }, 1)).toBe("Match");
  });
});
