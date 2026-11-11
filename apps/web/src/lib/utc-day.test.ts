import { describe, expect, it } from "vitest";
import { dayBefore, utcDayNumber } from "./utc-day";

describe("dayBefore", () => {
  it("steps back whole UTC days across a month and a year", () => {
    expect(dayBefore("2026-11-06", 7)).toBe("2026-10-30");
    expect(dayBefore("2026-01-01", 1)).toBe("2025-12-31");
    expect(dayBefore("2026-03-01", 30)).toBe("2026-01-30");
  });

  it("counts the days between two dates", () => {
    expect(utcDayNumber("2026-11-06") - utcDayNumber("2026-10-30")).toBe(7);
  });
});
