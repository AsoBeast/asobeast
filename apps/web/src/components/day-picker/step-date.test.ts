import { describe, expect, it } from "vitest";
import { stepDate } from "./step-date";

describe("stepDate", () => {
  const DATES = ["2026-10-13", "2026-10-11", "2026-10-08"];

  it("steps to the neighbouring captured day", () => {
    expect(stepDate(DATES, "2026-10-11", -1)).toBe("2026-10-08");
    expect(stepDate(DATES, "2026-10-11", 1)).toBe("2026-10-13");
  });

  it("steps from a day without a capture to the nearest one", () => {
    expect(stepDate(DATES, "2026-10-12", -1)).toBe("2026-10-11");
    expect(stepDate(DATES, "2026-10-12", 1)).toBe("2026-10-13");
  });

  it("stops at either end", () => {
    expect(stepDate(DATES, "2026-10-13", 1)).toBeNull();
    expect(stepDate(DATES, "2026-10-08", -1)).toBeNull();
  });
});
