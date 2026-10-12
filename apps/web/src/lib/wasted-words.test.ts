import { describe, expect, it } from "vitest";
import {
  limitedLines,
  moreLine,
  splitPhraseLine,
  wastedWordLine,
} from "./wasted-words";

describe("wasted word lines", () => {
  it("U-WST-30 names the localizations that hold a word", () => {
    expect(
      wastedWordLine({ word: "tracker", localizations: ["en-US", "es-MX"] }),
    ).toBe('"tracker" is in English (U.S.) and Spanish (Mexico).');
  });

  it("U-WST-31 lists three localizations with the list formatter", () => {
    expect(
      wastedWordLine({
        word: "timer",
        localizations: ["en-US", "es-MX", "fr"],
      }),
    ).toBe('"timer" is in English (U.S.), Spanish (Mexico), and French.');
  });

  it("U-WST-32 names the localizations behind each word of a split phrase", () => {
    expect(
      splitPhraseLine({
        keywordId: "k1",
        phrase: "habit planner",
        parts: [
          { word: "habit", localizations: ["en-US"] },
          { word: "planner", localizations: ["es-MX"] },
        ],
      }),
    ).toBe(
      '"habit planner": habit in English (U.S.), planner in Spanish (Mexico).',
    );
  });

  it("U-WST-33 joins several localizations of one word with and", () => {
    expect(
      splitPhraseLine({
        keywordId: "k1",
        phrase: "habit planner",
        parts: [
          { word: "habit", localizations: ["en-US", "en-GB"] },
          { word: "planner", localizations: ["es-MX"] },
        ],
      }),
    ).toBe(
      '"habit planner": habit in English (U.S.) and English (U.K.), planner in Spanish (Mexico).',
    );
  });
});

describe("line limits", () => {
  it("U-WST-34 shows every line up to the limit", () => {
    expect(limitedLines(["a", "b"], 5)).toEqual({
      shown: ["a", "b"],
      hidden: 0,
    });
  });

  it("U-WST-35 shows five lines and counts the rest", () => {
    expect(limitedLines(["a", "b", "c", "d", "e", "f", "g"])).toEqual({
      shown: ["a", "b", "c", "d", "e"],
      hidden: 2,
    });
  });

  it("U-WST-36 says how many more lines there are", () => {
    expect(moreLine(2)).toBe("and 2 more");
    expect(moreLine(1200)).toBe("and 1,200 more");
  });
});
