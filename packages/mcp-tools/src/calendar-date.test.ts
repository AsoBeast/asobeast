import { describe, expect, it } from "vitest";
import { isUtcCalendarDate } from "./calendar-date";

describe("isUtcCalendarDate", () => {
  it.each(["2026-02-28", "2028-02-29"])("accepts %s", (value) => {
    expect(isUtcCalendarDate(value)).toBe(true);
  });

  it.each([
    "2026-02-29",
    "2026-02-30",
    "2026-09-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
  ])("refuses %s, which is not on the calendar", (value) => {
    expect(isUtcCalendarDate(value)).toBe(false);
  });

  it.each(["2026-9-01", "20260901", "2026-09-01T00:00:00Z"])(
    "refuses %s, which is not a utc date string",
    (value) => {
      expect(isUtcCalendarDate(value)).toBe(false);
    },
  );
});
