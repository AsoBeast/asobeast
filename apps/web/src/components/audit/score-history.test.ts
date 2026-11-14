import { describe, expect, it } from "vitest";
import { scoredPoints, weekChange } from "./score-history";

const point = (date: string, overall: number | null) => ({
  date,
  overall,
  coveredWeight: 90,
  totalWeight: 110,
});

describe("scoredPoints", () => {
  it("drops the days without a score", () => {
    expect(
      scoredPoints([point("2026-11-01", null), point("2026-11-02", 61)]),
    ).toEqual([point("2026-11-02", 61)]);
  });
});

describe("weekChange", () => {
  it("compares the newest score with the newest one at least a week older", () => {
    expect(
      weekChange([
        point("2026-11-05", 60.2),
        point("2026-11-06", 65.1),
        point("2026-11-10", 70.9),
        point("2026-11-13", 74.2),
      ]),
    ).toBe(9);
  });

  it("reads a falling score as a negative change", () => {
    expect(
      weekChange([point("2026-11-06", 61.4), point("2026-11-13", 58.2)]),
    ).toBe(-3);
  });

  it("is the difference of the two figures the page shows", () => {
    expect(
      weekChange([point("2026-11-06", 64.5), point("2026-11-13", 73.4)]),
    ).toBe(8);
  });

  it("has no change without a score a week back", () => {
    expect(
      weekChange([point("2026-11-07", 62.4), point("2026-11-13", 74.2)]),
    ).toBeNull();
    expect(weekChange([point("2026-11-13", 74.2)])).toBeNull();
    expect(weekChange([])).toBeNull();
  });

  it("skips unscored days on both ends", () => {
    expect(
      weekChange([
        point("2026-11-05", 60),
        point("2026-11-06", null),
        point("2026-11-13", 70),
        point("2026-11-14", null),
      ]),
    ).toBe(10);
  });
});
