import { describe, expect, it } from "vitest";
import { previousRange, withPrevious } from "./visibility-rows";

describe("previousRange", () => {
  it("moves both ends back by the length of the range", () => {
    expect(previousRange({ from: "2026-10-12", to: "2026-11-11" }, 30)).toEqual(
      { from: "2026-09-12", to: "2026-10-12" },
    );
  });
});

describe("withPrevious", () => {
  it("pairs each day with the same day of the range before", () => {
    const rows = withPrevious(
      [
        { date: "2026-11-10", visibility: 60 },
        { date: "2026-11-11", visibility: 62 },
      ],
      [
        { date: "2026-10-11", visibility: 50 },
        { date: "2026-10-12", visibility: 51 },
      ],
      30,
    );

    expect(rows).toEqual([
      { date: "2026-11-10", visibility: 60, previous: 50 },
      { date: "2026-11-11", visibility: 62, previous: 51 },
    ]);
  });

  it("leaves a day without an earlier point empty", () => {
    const rows = withPrevious(
      [
        { date: "2026-11-10", visibility: 60 },
        { date: "2026-11-11", visibility: 62 },
      ],
      [{ date: "2026-10-12", visibility: 0 }],
      30,
    );

    expect(rows.map((row) => row.previous)).toEqual([null, 0]);
  });

  it("keeps the rows when there is no earlier range", () => {
    expect(
      withPrevious([{ date: "2026-11-11", visibility: 62 }], [], 30),
    ).toEqual([{ date: "2026-11-11", visibility: 62, previous: null }]);
  });
});
