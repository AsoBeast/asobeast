import { describe, expect, it } from "vitest";
import {
  monthGrid,
  monthLabel,
  monthOf,
  monthWeeks,
  shiftMonth,
} from "./calendar-grid";

describe("calendar grid", () => {
  it("reads the month of a day", () => {
    expect(monthOf("2026-10-13")).toEqual({ year: 2026, month: 10 });
  });

  it("lays a month out in six weeks starting on monday", () => {
    const cells = monthGrid({ year: 2026, month: 10 });

    expect(cells).toHaveLength(42);
    expect(cells.slice(0, 4).map((cell) => cell.date)).toEqual([
      null,
      null,
      null,
      "2026-10-01",
    ]);
    expect(cells[3].weekday).toBe(3);
    expect(cells.filter((cell) => cell.date !== null)).toHaveLength(31);
    expect(cells.at(-1)?.date).toBeNull();
  });

  it("splits a month into six weeks of seven days", () => {
    const weeks = monthWeeks({ year: 2026, month: 10 });

    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][3].date).toBe("2026-10-01");
  });

  it("knows a leap february", () => {
    const dates = monthGrid({ year: 2028, month: 2 })
      .map((cell) => cell.date)
      .filter((date) => date !== null);

    expect(dates.at(-1)).toBe("2028-02-29");
  });

  it("shifts across a year", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });

  it("names a month in words", () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe("October 2026");
  });
});
