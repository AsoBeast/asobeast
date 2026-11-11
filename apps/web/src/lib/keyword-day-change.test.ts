import { describe, expect, it } from "vitest";
import {
  countedDayChange,
  dayChange,
  dayChangeRank,
  KEYWORD_MOVE_FILTERS,
  keywordMoves,
  matchesMoveFilter,
  movesSentence,
  type DayChangeRow,
} from "./keyword-day-change";

const TODAY = "2026-11-11";

const row = (change: Partial<DayChangeRow> = {}): DayChangeRow => ({
  active: true,
  latestPosition: 12,
  latestDepth: 200,
  latestCheckedOn: TODAY,
  previousPosition: 12,
  positionDelta1d: 0,
  ...change,
});

const rose = row({
  latestPosition: 3,
  previousPosition: 5,
  positionDelta1d: -2,
});
const fell = row({
  latestPosition: 15,
  previousPosition: 12,
  positionDelta1d: 3,
});
const steady = row();
const lost = row({
  latestPosition: null,
  previousPosition: 14,
  positionDelta1d: null,
});
const entered = row({
  latestPosition: 41,
  previousPosition: null,
  positionDelta1d: null,
  recentPositions: [
    { date: "2026-11-10", position: null },
    { date: TODAY, position: 41 },
  ],
});

describe("dayChange", () => {
  it("reads a better position as a move of negative places", () => {
    expect(dayChange(rose, TODAY)).toEqual({ kind: "moved", places: -2 });
    expect(dayChange(fell, TODAY)).toEqual({ kind: "moved", places: 3 });
    expect(dayChange(steady, TODAY)).toEqual({ kind: "steady" });
  });

  it("works the places out when the delta is missing", () => {
    expect(
      dayChange(
        row({ latestPosition: 9, previousPosition: 4, positionDelta1d: null }),
        TODAY,
      ),
    ).toEqual({ kind: "moved", places: 5 });
  });

  it("reads a rank that vanished since the check before as lost", () => {
    expect(dayChange(lost, TODAY)).toEqual({ kind: "lost" });
  });

  it("does not call a keyword lost on every later day", () => {
    expect(
      dayChange(
        row({
          latestPosition: null,
          previousPosition: null,
          positionDelta1d: null,
        }),
        TODAY,
      ),
    ).toBeNull();
  });

  it("reads a rank after a check that found nothing as entered", () => {
    expect(dayChange(entered, TODAY)).toEqual({ kind: "entered" });
  });

  it.each([
    ["a first check", [{ date: TODAY, position: 41 }]],
    ["an answer without recent checks", undefined],
    [
      "a ranked check before",
      [
        { date: "2026-11-10", position: 50 },
        { date: TODAY, position: 41 },
      ],
    ],
  ])("does not call %s entered", (_name, recentPositions) => {
    expect(dayChange({ ...entered, recentPositions }, TODAY)).toBeNull();
  });

  it("has nothing to say about a keyword never checked or checked days ago", () => {
    expect(dayChange(row({ latestDepth: null }), TODAY)).toBeNull();
    expect(
      dayChange({ ...fell, latestCheckedOn: "2026-11-01" }, TODAY),
    ).toBeNull();
  });

  it("keeps the change of a keyword whose answer carries no check day", () => {
    expect(dayChange({ ...fell, latestCheckedOn: undefined }, TODAY)).toEqual({
      kind: "moved",
      places: 3,
    });
  });

  it("shows a paused keyword's change and leaves it out of the counts", () => {
    const paused = { ...fell, active: false };

    expect(dayChange(paused, TODAY)).toEqual({ kind: "moved", places: 3 });
    expect(countedDayChange(paused, TODAY)).toBeNull();
  });
});

describe("dayChangeRank", () => {
  it("orders lost above every fall and entered below every rise", () => {
    const ranks = [entered, rose, steady, fell, lost].map((keyword) =>
      dayChangeRank(dayChange(keyword, TODAY)),
    );

    expect(ranks).toEqual([...ranks].sort((left, right) => left! - right!));
    expect(dayChangeRank(null)).toBeNull();
  });
});

describe("matchesMoveFilter", () => {
  const matching = (keyword: DayChangeRow) =>
    KEYWORD_MOVE_FILTERS.filter((filter) =>
      matchesMoveFilter(keyword, TODAY, filter),
    );

  it("sorts each change into the filters that hold it", () => {
    expect(matching(rose)).toEqual(["moved"]);
    expect(matching(entered)).toEqual(["moved"]);
    expect(matching(fell)).toEqual(["moved", "fell"]);
    expect(matching(lost)).toEqual(["moved", "fell", "lost"]);
    expect(matching(steady)).toEqual([]);
  });

  it("matches no paused, stale or unchecked keyword", () => {
    expect(matching({ ...lost, active: false })).toEqual([]);
    expect(matching({ ...lost, latestCheckedOn: "2026-11-01" })).toEqual([]);
    expect(matching(row({ latestDepth: null }))).toEqual([]);
  });
});

describe("keywordMoves", () => {
  it("counts rises, falls, lost and entered keywords apart", () => {
    expect(
      keywordMoves([rose, fell, fell, steady, lost, entered], TODAY),
    ).toEqual({ up: 1, down: 2, lost: 1, entered: 1 });
  });

  it("leaves out a paused keyword, a stale check and one never checked", () => {
    expect(
      keywordMoves(
        [
          { ...rose, active: false },
          { ...fell, latestCheckedOn: "2026-11-01" },
          row({ latestDepth: null, positionDelta1d: 4 }),
          fell,
        ],
        TODAY,
      ),
    ).toEqual({ up: 0, down: 1, lost: 0, entered: 0 });
  });
});

describe("movesSentence", () => {
  const none = { up: 0, down: 0, lost: 0, entered: 0 };

  it.each([
    [none, "No keyword moved since yesterday."],
    [{ ...none, up: 2 }, "2 moved up since yesterday."],
    [{ ...none, down: 1 }, "1 moved down since yesterday."],
    [{ ...none, lost: 1 }, "1 dropped out since yesterday."],
    [
      { ...none, up: 2, down: 1 },
      "2 moved up and 1 moved down since yesterday.",
    ],
    [
      { up: 2, down: 1, lost: 1, entered: 3 },
      "2 moved up, 1 moved down, 1 dropped out, and 3 entered the results since yesterday.",
    ],
  ])("writes %o as %s", (moves, sentence) => {
    expect(movesSentence(moves)).toBe(sentence);
  });
});
