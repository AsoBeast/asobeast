import { describe, expect, it } from "vitest";
import type { PortfolioRangeChange } from "@asobeast/shared";
import { movementLede, quietSentence } from "./movement-sentence";

const change = (
  up: number,
  down: number,
  rest: Partial<PortfolioRangeChange> = {},
): PortfolioRangeChange => ({
  compared: true,
  visibilityDelta: 1,
  top10Delta: 0,
  movement: { up, down, entered: 0, lost: 0 },
  appsMoved: 1,
  movers: { up: [], down: [] },
  ...rest,
});

const sentence = (...parts: Parameters<typeof movementLede>): string => {
  const { lead, fact, tail } = movementLede(...parts);
  return `${lead}${fact}${tail}`;
};

describe("movementLede", () => {
  it("separates the fact from the words around it", () => {
    expect(movementLede(change(4, 3, { appsMoved: 5 }), 30)).toEqual({
      lead: "In the last 30 days ",
      fact: "4 keywords climbed and 3 fell",
      tail: " across 5 apps.",
    });
  });

  it("says no keyword moved once the range has a day to compare with", () => {
    expect(sentence(change(0, 0), 7)).toBe(
      "No keyword moved in the last 7 days.",
    );
  });

  it("says when movement will appear before the range has history", () => {
    expect(sentence(change(0, 0, { compared: false }), 90)).toBe(
      "Movement appears after 90 days of daily runs.",
    );
  });

  it("leaves the app count out for a single app", () => {
    expect(sentence(change(1, 0), 7)).toBe(
      "In the last 7 days 1 keyword climbed.",
    );
  });

  it("counts a fall alone with its noun", () => {
    expect(sentence(change(0, 2, { appsMoved: 2 }), 7)).toBe(
      "In the last 7 days 2 keywords fell across 2 apps.",
    );
  });
});

describe("quietSentence", () => {
  it("names the range it speaks for", () => {
    expect(quietSentence(true, 30)).toBe(
      "No keyword moved in the last 30 days.",
    );
  });
});
