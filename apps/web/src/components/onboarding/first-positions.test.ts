import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  FIRST_POSITIONS_LIMIT,
  firstPositions,
  positionLabel,
} from "./first-positions";

const firstPositionRows = (keywords: TrackedKeywordItem[]) =>
  firstPositions(keywords).rows;

const firstPositionsHeadline = (keywords: TrackedKeywordItem[]) =>
  firstPositions(keywords).headline;

const keyword = (
  text: string,
  position: number | null,
  depth: number | null,
  active = true,
): TrackedKeywordItem =>
  ({
    keywordId: `kw-${text}`,
    text,
    active,
    latestPosition: position,
    latestDepth: depth,
  }) as TrackedKeywordItem;

describe("firstPositionRows", () => {
  it("keeps the active keywords that were checked", () => {
    const rows = firstPositionRows([
      keyword("checked", 4, 200),
      keyword("unchecked", null, null),
      keyword("paused", 2, 200, false),
    ]);

    expect(rows.map((row) => row.text)).toEqual(["checked"]);
  });

  it("puts the best position first and a keyword outside the depth last", () => {
    const rows = firstPositionRows([
      keyword("outside", null, 200),
      keyword("fifteenth", 15, 200),
      keyword("second", 2, 200),
      keyword("also fifteenth", 15, 200),
    ]);

    expect(rows.map((row) => row.text)).toEqual([
      "second",
      "also fifteenth",
      "fifteenth",
      "outside",
    ]);
  });

  it("lists at most the limit", () => {
    const keywords = Array.from({ length: 12 }, (_, index) =>
      keyword(`k${index}`, index + 1, 200),
    );

    expect(firstPositionRows(keywords)).toHaveLength(FIRST_POSITIONS_LIMIT);
  });
});

describe("firstPositionsHeadline", () => {
  it("says positions are collected before any keyword was checked", () => {
    expect(
      firstPositionsHeadline([
        keyword("a", null, null),
        keyword("b", null, null),
      ]),
    ).toBe("Positions are being collected for 2 keywords.");
  });

  it("names the best position", () => {
    expect(
      firstPositionsHeadline([
        keyword("pomodoro", 15, 200),
        keyword("focus timer", 3, 200),
      ]),
    ).toBe("Your app ranks #3 for “focus timer”.");
  });

  it("names the smallest depth when no checked keyword was found", () => {
    expect(
      firstPositionsHeadline([
        keyword("a", null, 200),
        keyword("b", null, 100),
      ]),
    ).toBe("Checked 2 of 2 keywords, none in the top 100 yet.");
  });

  it("says no checked keyword is inside the depth yet", () => {
    expect(
      firstPositionsHeadline([
        keyword("a", null, 200),
        keyword("b", null, 200),
        keyword("c", null, null),
      ]),
    ).toBe("Checked 2 of 3 keywords, none in the top 200 yet.");
  });
});

describe("positionLabel", () => {
  it("writes a position or the depth it was not found within", () => {
    const [found, missing] = firstPositionRows([
      keyword("found", 7, 200),
      keyword("missing", null, 100),
    ]);

    expect(positionLabel(found)).toBe("#7");
    expect(positionLabel(missing)).toBe("not in the top 100");
  });
});
