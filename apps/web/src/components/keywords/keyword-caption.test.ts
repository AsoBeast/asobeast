import { describe, expect, it } from "vitest";
import { keywordTableCaption } from "./keyword-caption";

const NONE = { added: false, playInstalls: false, competitors: false };

describe("keywordTableCaption", () => {
  it("names the default columns", () => {
    expect(keywordTableCaption(NONE)).toBe(
      "Tracked keywords with source, position and its daily change, popularity, difficulty, opportunity, 7 day change, and top 10 volatility.",
    );
  });

  it("names every optional column that is on screen", () => {
    expect(
      keywordTableCaption({
        added: true,
        playInstalls: true,
        competitors: true,
      }),
    ).toBe(
      "Tracked keywords with source, date added, position and its daily change, popularity, difficulty, opportunity, Play installs per search term, 7 day change, top 10 volatility, and competitors in the top 10.",
    );
  });
});
