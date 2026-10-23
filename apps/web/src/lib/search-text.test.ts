import { describe, expect, it } from "vitest";
import {
  containsEmoji,
  hasSearchTerms,
  matchesSearch,
  searchText,
} from "./search-text";

describe("searchText", () => {
  it("folds case and accents", () => {
    expect(searchText("Crème Brûlée")).toBe(searchText("creme brulee"));
  });
});

describe("matchesSearch", () => {
  it("matches any part without accents or case", () => {
    expect(matchesSearch(["Focus Timer", "Österreich"], "osterr")).toBe(true);
    expect(matchesSearch(["Focus Timer"], "calm")).toBe(false);
  });

  it("matches everything for an empty or blank query", () => {
    expect(matchesSearch(["Focus Timer"], "")).toBe(true);
    expect(matchesSearch(["Focus Timer"], "   ")).toBe(true);
  });

  it("matches an emoji only query on the parts that hold it", () => {
    expect(matchesSearch(["Love it 🎉🎉"], "🎉")).toBe(true);
    expect(matchesSearch(["Plain review"], "🎉")).toBe(false);
    expect(matchesSearch(["Plain", "Fire 🔥"], "🎉")).toBe(false);
  });

  it("keeps a run of emoji together", () => {
    expect(matchesSearch(["Love it 🎉🎉"], "🎉🎉")).toBe(true);
    expect(matchesSearch(["One 🎉 only"], "🎉🎉")).toBe(false);
    expect(matchesSearch(["🎉 and 🎉"], "🎉🎉")).toBe(false);
  });

  it("needs every separate run", () => {
    expect(matchesSearch(["🎉 and 🔥"], "🎉 🔥")).toBe(true);
    expect(matchesSearch(["🎉 only"], "🎉 🔥")).toBe(false);
  });

  it("matches a joined sequence as a whole", () => {
    expect(matchesSearch(["Family 👨‍👩‍👧‍👦 plan"], "👨‍👩‍👧‍👦")).toBe(true);
    expect(matchesSearch(["Man 👨 only"], "👨‍👩‍👧‍👦")).toBe(false);
    expect(matchesSearch(["Family 👨‍👩‍👧‍👦 plan"], "👨")).toBe(true);
  });

  it("matches a keycap as an emoji", () => {
    expect(
      matchesSearch(["Rated #\u{FE0F}\u{20E3} one"], "#\u{FE0F}\u{20E3}"),
    ).toBe(true);
    expect(matchesSearch(["Plain review"], "#\u{FE0F}\u{20E3}")).toBe(false);
    expect(matchesSearch(["Plain review"], "*\u{FE0F}\u{20E3}")).toBe(false);
    expect(matchesSearch(["Version 1.2, 10/10"], "1\u{FE0F}\u{20E3}")).toBe(
      false,
    );
    expect(
      matchesSearch(["Step 1\u{FE0F}\u{20E3} done"], "1\u{FE0F}\u{20E3}"),
    ).toBe(true);
  });

  it("matches a skin tone searched on its own", () => {
    expect(matchesSearch(["Nice \u{1F44D}\u{1F3FD}"], "\u{1F3FD}")).toBe(true);
    expect(matchesSearch(["Nice \u{1F44D}"], "\u{1F3FD}")).toBe(false);
  });

  it("matches with or without the emoji presentation selector", () => {
    expect(matchesSearch(["I ❤️ it"], "❤")).toBe(true);
    expect(matchesSearch(["I ❤ it"], "❤️")).toBe(true);
  });

  it("matches a flag and a skin tone", () => {
    expect(matchesSearch(["Made in 🇵🇱"], "🇵🇱")).toBe(true);
    expect(matchesSearch(["Made in 🇩🇪"], "🇵🇱")).toBe(false);
    expect(matchesSearch(["Nice 👍🏽"], "👍")).toBe(true);
    expect(matchesSearch(["Nice 👍🏽"], "👍🏽")).toBe(true);
    expect(matchesSearch(["Nice 👍"], "👍🏽")).toBe(false);
  });

  it("requires the words and the emoji of a mixed query", () => {
    expect(matchesSearch(["Family plan 🎉"], "Family 🎉")).toBe(true);
    expect(matchesSearch(["Family plan"], "Family 🎉")).toBe(false);
    expect(matchesSearch(["Party 🎉"], "Family 🎉")).toBe(false);
  });

  it("leaves punctuation and other symbols out of the search", () => {
    expect(matchesSearch(["Focus Timer"], "(*)")).toBe(true);
    expect(matchesSearch(["Focus Timer"], "\\")).toBe(true);
    expect(matchesSearch(["Focus Timer"], "$")).toBe(true);
    expect(matchesSearch(["Focus Timer"], "focus!")).toBe(true);
  });

  it("does not read a zero width joiner between letters as an emoji", () => {
    expect(matchesSearch(["a b"], "a\u{200D}b")).toBe(true);
    expect(hasSearchTerms("\u{200D}")).toBe(false);
  });
});

describe("hasSearchTerms", () => {
  it("is true for words and for emoji", () => {
    expect(hasSearchTerms("crash")).toBe(true);
    expect(hasSearchTerms("🎉")).toBe(true);
    expect(hasSearchTerms('"🎉"')).toBe(true);
  });

  it("is false for blank text and for punctuation", () => {
    expect(hasSearchTerms("")).toBe(false);
    expect(hasSearchTerms("   ")).toBe(false);
    expect(hasSearchTerms('""')).toBe(false);
    expect(hasSearchTerms("(*)")).toBe(false);
  });
});

describe("containsEmoji", () => {
  it("holds for a query with no emoji", () => {
    expect(containsEmoji(["anything"], "words")).toBe(true);
  });

  it("looks only for the emoji of the query", () => {
    expect(containsEmoji(["Great 🎉"], "party 🎉")).toBe(true);
    expect(containsEmoji(["Great"], "party 🎉")).toBe(false);
  });
});
