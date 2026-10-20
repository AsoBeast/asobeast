import { describe, expect, it } from "vitest";
import type {
  KeywordBreakdownApp,
  KeywordBreakdownField,
  KeywordBreakdownInsight,
  KeywordBreakdownStanding,
  KeywordWordMatch,
} from "@asobeast/shared";
import {
  fieldLabel,
  fieldVerdict,
  insightText,
  placementPhrase,
  rankingLabel,
  ratingLine,
  standingLines,
} from "./breakdown-text";

const field = (
  matches: KeywordWordMatch[],
  phrase = false,
): KeywordBreakdownField => ({
  field: "title",
  phrase,
  words: matches.map((match, index) => ({ word: `w${index}`, match })),
  segments: [],
});

const standing = (
  overrides: Partial<KeywordBreakdownStanding> = {},
): KeywordBreakdownStanding => ({
  checked: true,
  above: 0,
  competitors: 2,
  missingWords: [],
  foldedWords: [],
  recentChange: null,
  ...overrides,
});

describe("fieldLabel", () => {
  it.each([
    ["title", "Title"],
    ["subtitle", "Subtitle"],
    ["keywordField", "Keyword field"],
    ["shortDescription", "Short description"],
    ["description", "Long description"],
  ] as const)("names %s", (name, label) => {
    expect(fieldLabel(name)).toBe(label);
  });
});

describe("fieldVerdict", () => {
  it("says whole phrase", () => {
    expect(fieldVerdict(field(["exact", "exact"], true))).toBe("Whole phrase");
  });

  it("says every word without the phrase", () => {
    expect(fieldVerdict(field(["exact", "exact"]))).toBe("Every word");
  });

  it("counts some words", () => {
    expect(fieldVerdict(field(["exact", "exact", "none"]))).toBe(
      "2 of 3 words",
    );
  });

  it("says found for a one word keyword", () => {
    expect(fieldVerdict(field(["exact"], true))).toBe("Whole phrase");
    expect(fieldVerdict(field(["exact"]))).toBe("Found");
  });

  it("says no match", () => {
    expect(fieldVerdict(field(["none", "none"]))).toBe("No match");
    expect(fieldVerdict(field([]))).toBe("No match");
  });

  it("adds that accents differ", () => {
    expect(fieldVerdict(field(["exact", "folded"]))).toBe(
      "Every word, accents differ",
    );
    expect(fieldVerdict(field(["folded"]))).toBe("Found, accents differ");
    expect(fieldVerdict(field(["folded", "none", "none"]))).toBe(
      "1 of 3 words, accents differ",
    );
  });
});

describe("rankingLabel", () => {
  it("names the three ranking states", () => {
    expect(rankingLabel(null)).toBe("Not checked yet");
    expect(
      rankingLabel({ position: null, depth: 200, date: "2026-10-18" }),
    ).toBe(">200");
    expect(rankingLabel({ position: 4, depth: 200, date: "2026-10-18" })).toBe(
      "#4",
    );
  });
});

describe("placementPhrase", () => {
  it.each([
    ["title", false, "in its title"],
    ["keywordField", true, "in your keyword field"],
    ["shortDescription", false, "in its short description"],
    ["split", false, "every word, spread over fields"],
    ["partial", true, "some of the words"],
    ["none", false, "none of the words"],
  ] as const)("words %s", (placement, yours, phrase) => {
    expect(placementPhrase(placement, yours)).toBe(phrase);
  });
});

describe("insightText", () => {
  it("explains a stronger placement", () => {
    expect(
      insightText(
        { rule: "placement", theirs: "title", yours: "keywordField" },
        "APP_STORE",
        "none",
      ),
    ).toBe(
      "May rank above you because it has the keyword in its title, while yours is in your keyword field.",
    );
    expect(
      insightText(
        { rule: "placement", theirs: "subtitle", yours: "partial" },
        "APP_STORE",
        "none",
      ),
    ).toBe(
      "May rank above you because it has the keyword in its subtitle, while your listings hold some of the words.",
    );
  });

  it("explains an exact spelling", () => {
    expect(
      insightText(
        { rule: "spelling", words: ["guidees"] },
        "APP_STORE",
        "none",
      ),
    ).toBe(
      "Spells “guidees” exactly as searched, where your listings match it only with accents ignored. Stores usually match both spellings, but the exact one can still help.",
    );
  });

  it("explains far more ratings", () => {
    expect(
      insightText(
        { rule: "ratings", theirs: 12000, yours: 300 },
        "APP_STORE",
        "none",
      ),
    ).toBe("Its listing here has 12,000 ratings to your 300.");
  });

  it("names the listings it could not read", () => {
    expect(
      insightText(
        { rule: "unread", localizations: ["es-MX"] },
        "APP_STORE",
        "none",
      ),
    ).toBe(
      "None of the words show in what AsoBeast read, and its Spanish (Mexico) listing has not been captured.",
    );
    expect(
      insightText(
        { rule: "unread", localizations: ["es-MX", "fr"] },
        "APP_STORE",
        "none",
      ),
    ).toBe(
      "None of the words show in what AsoBeast read, and its Spanish (Mexico) and French listings have not been captured.",
    );
  });

  it("does not say a partial match shows nothing", () => {
    const text = insightText(
      { rule: "unread", localizations: ["ar"] },
      "APP_STORE",
      "partial",
    );

    expect(text).toBe(
      "Only some of the words show in what AsoBeast read, and its Arabic listing has not been captured.",
    );
    expect(text).not.toContain("No visible match");
  });

  it("points at the private keyword field", () => {
    expect(insightText({ rule: "hidden" }, "APP_STORE", "none")).toBe(
      "None of the words show in any listing this market searches, so it may rank through its private keyword field.",
    );
    expect(insightText({ rule: "hidden" }, "APP_STORE", "partial")).toBe(
      "Only some of the words show in any listing this market searches, so it may rank through its private keyword field.",
    );
  });

  it("says when nothing visible explains it", () => {
    expect(insightText({ rule: "similar" }, "APP_STORE", "none")).toBe(
      "Placement and ratings are close to yours; installs and its keyword field are not visible.",
    );
    expect(insightText({ rule: "similar" }, "GOOGLE_PLAY", "none")).toBe(
      "Placement and ratings are close to yours; installs are not visible.",
    );
  });

  it("answers nothing for a rule it does not know", () => {
    expect(
      insightText(
        { rule: "momentum" } as unknown as KeywordBreakdownInsight,
        "APP_STORE",
        "none",
      ),
    ).toBeNull();
  });
});

describe("standingLines", () => {
  it("counts the competitors above you", () => {
    expect(standingLines(standing({ above: 1 }))).toEqual([
      "1 of 2 competitors ranks above you.",
    ]);
    expect(standingLines(standing({ above: 2 }))).toEqual([
      "2 of 2 competitors rank above you.",
    ]);
    expect(standingLines(standing({ above: 1, competitors: 1 }))).toEqual([
      "1 of 1 competitor ranks above you.",
    ]);
  });

  it("says when no competitor ranks above you", () => {
    expect(standingLines(standing())).toEqual([
      "No tracked competitor ranks above you.",
    ]);
    expect(standingLines(standing({ competitors: 0 }))).toEqual([]);
  });

  it("names the words your listings lack or only match with accents ignored", () => {
    expect(
      standingLines(
        standing({
          missingWords: ["productivity"],
          foldedWords: ["pomodoro"],
        }),
      ),
    ).toEqual([
      "No tracked competitor ranks above you.",
      "Your listings hold no “productivity”, so you may not be eligible for this search.",
      "“pomodoro” matches only with accents ignored.",
    ]);
    expect(
      standingLines(standing({ foldedWords: ["visites", "guidees"] }))[1],
    ).toBe("“visites” and “guidees” match only with accents ignored.");
  });

  it("dates a recent change", () => {
    expect(
      standingLines(
        standing({ recentChange: { date: "2026-10-12", source: "listing" } }),
      )[1],
    ).toBe(
      "Your listing changed on Oct 12, 2026; ranks usually settle two to four weeks after a change.",
    );
    expect(
      standingLines(
        standing({
          recentChange: { date: "2026-10-12", source: "keywordField" },
        }),
      )[1],
    ).toBe(
      "You saved a keyword field this market reads on Oct 12, 2026; ranks usually settle two to four weeks after a change.",
    );
  });

  it("says nothing about competitors before you are checked", () => {
    expect(
      standingLines(standing({ checked: false, missingWords: ["timer"] })),
    ).toEqual([
      "Your app has not been checked for this keyword yet.",
      "Your listings hold no “timer”, so you may not be eligible for this search.",
    ]);
  });
});

describe("ratingLine", () => {
  const app = (rating: KeywordBreakdownApp["rating"]): KeywordBreakdownApp =>
    ({ rating }) as KeywordBreakdownApp;

  it("says nothing when the rating has neither an average nor a count", () => {
    expect(
      ratingLine(app({ average: null, count: null, country: "us" }), "us"),
    ).toBeNull();
    expect(
      ratingLine(app({ average: null, count: null, country: "gb" }), "us"),
    ).toBeNull();
  });

  it("names the rating and where it was read", () => {
    expect(
      ratingLine(app({ average: 4.2, count: 300, country: "gb" }), "us"),
    ).toBe("Rating 4.2 from 300 ratings (United Kingdom listing)");
  });
});
