import { describe, expect, it } from "vitest";
import { keywordMoves, movesSentence } from "./keyword-moves";

const TODAY = "2026-11-11";

const row = (positionDelta1d: number | null, latestCheckedOn = TODAY) => ({
  active: true,
  latestCheckedOn,
  positionDelta1d,
});

describe("keywordMoves", () => {
  it("counts a lower position as a move up", () => {
    expect(
      keywordMoves([row(-2), row(3), row(1), row(0), row(null)], TODAY),
    ).toEqual({ up: 1, down: 2 });
  });

  it("leaves out a keyword whose last check is stale", () => {
    expect(keywordMoves([row(-2, "2026-11-01"), row(-1)], TODAY)).toEqual({
      up: 1,
      down: 0,
    });
  });
});

describe("movesSentence", () => {
  it.each([
    [{ up: 0, down: 0 }, "No position moved since yesterday."],
    [{ up: 2, down: 0 }, "2 moved up since yesterday."],
    [{ up: 0, down: 1 }, "1 moved down since yesterday."],
    [{ up: 2, down: 1 }, "2 moved up and 1 moved down since yesterday."],
  ])("writes %o as %s", (moves, sentence) => {
    expect(movesSentence(moves)).toBe(sentence);
  });
});
