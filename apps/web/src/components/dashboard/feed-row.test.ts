import { describe, expect, it } from "vitest";
import { feedDayLabel } from "./feed-row";

describe("feedDayLabel", () => {
  it("words today and yesterday and dates every earlier day", () => {
    expect(feedDayLabel("2026-11-06", "2026-11-06")).toBe("Today");
    expect(feedDayLabel("2026-11-05", "2026-11-06")).toBe("Yesterday");
    expect(feedDayLabel("2026-11-04", "2026-11-06")).toBe("Nov 4");
  });

  it("crosses a month boundary for yesterday", () => {
    expect(feedDayLabel("2026-10-31", "2026-11-01")).toBe("Yesterday");
  });
});
