import { describe, expect, it } from "vitest";
import { scoredPoints, weekChange } from "./score-history";

const point = (date: string, overall: number | null) => ({
  date,
  overall,
  coveredWeight: 90,
  totalWeight: 110,
});

const audit = (
  overall: number | null,
  generatedAt = "2026-11-13T04:10:00Z",
) => ({
  overall,
  generatedAt,
});

describe("scoredPoints", () => {
  it("drops the days without a score", () => {
    expect(
      scoredPoints([point("2026-11-01", null), point("2026-11-02", 61)]),
    ).toEqual([point("2026-11-02", 61)]);
  });
});

describe("weekChange", () => {
  it("compares the audit's score with the newest snapshot at least a week older", () => {
    expect(
      weekChange(
        [
          point("2026-11-05", 60.2),
          point("2026-11-06", 65.1),
          point("2026-11-10", 70.9),
          point("2026-11-13", 74.2),
        ],
        audit(74.2),
      ),
    ).toBe(9);
  });

  it("reads a falling score as a negative change", () => {
    expect(
      weekChange(
        [point("2026-11-06", 61.4), point("2026-11-13", 58.2)],
        audit(58.2),
      ),
    ).toBe(-3);
  });

  it("measures from the score the page shows, not from the last snapshot", () => {
    expect(
      weekChange(
        [point("2026-11-06", 65.1), point("2026-11-13", 74.2)],
        audit(78.4),
      ),
    ).toBe(13);
  });

  it("is the difference of the two rounded figures", () => {
    expect(weekChange([point("2026-11-06", 64.5)], audit(73.4))).toBe(8);
  });

  it("has no change without a snapshot a week back", () => {
    expect(
      weekChange(
        [point("2026-11-07", 62.4), point("2026-11-13", 74.2)],
        audit(74.2),
      ),
    ).toBeNull();
    expect(weekChange([], audit(74.2))).toBeNull();
  });

  it("does not call a month old snapshot last week", () => {
    expect(weekChange([point("2026-10-10", 60)], audit(74.2))).toBeNull();
    expect(weekChange([point("2026-10-31", 60)], audit(74.2))).toBe(14);
    expect(weekChange([point("2026-10-30", 60)], audit(74.2))).toBeNull();
  });

  it("skips unscored days and has no change without a score", () => {
    expect(
      weekChange(
        [point("2026-11-05", 60), point("2026-11-06", null)],
        audit(70),
      ),
    ).toBe(10);
    expect(weekChange([point("2026-11-06", 60)], audit(null))).toBeNull();
  });
});
