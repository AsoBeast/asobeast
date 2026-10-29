import { describe, expect, it } from "vitest";
import { chartImageFilename, slugPart } from "./filename";

describe("slugPart", () => {
  it.each([
    ["Focus Timer: Pomodoro", "focus-timer-pomodoro"],
    ["  Café Ünïcode  ", "cafe-unicode"],
    ["a/b\\c:d*e", "a-b-c-d-e"],
    ["---x---", "x"],
    ["タイマー", ""],
    ["", ""],
    ["a".repeat(60), "a".repeat(40)],
    [`${"a".repeat(39)} b`, "a".repeat(39)],
  ])("turns %j into %j", (value, expected) => {
    expect(slugPart(value)).toBe(expected);
  });
});

describe("chartImageFilename", () => {
  const base = {
    appName: "Focus Timer",
    appId: "app-1",
    from: "2026-09-28",
    to: "2026-10-28",
  };

  it("names the rankings chart after the app and the plotted days", () => {
    expect(chartImageFilename({ ...base, chart: "rankings" })).toBe(
      "asobeast-rankings-focus-timer-2026-09-28-2026-10-28.png",
    );
  });

  it("adds the keyword of a position history", () => {
    expect(
      chartImageFilename({
        ...base,
        chart: "position-history",
        keyword: "Pomodoro Timer!",
      }),
    ).toBe(
      "asobeast-position-history-focus-timer-pomodoro-timer-2026-09-28-2026-10-28.png",
    );
  });

  it("falls back to the app id when the name has no latin letters", () => {
    expect(
      chartImageFilename({
        ...base,
        appName: "集中タイマー",
        chart: "rankings",
      }),
    ).toBe("asobeast-rankings-app-1-2026-09-28-2026-10-28.png");
  });

  it("falls back to the app id when the app has no name", () => {
    expect(
      chartImageFilename({ ...base, appName: null, chart: "rankings" }),
    ).toBe("asobeast-rankings-app-1-2026-09-28-2026-10-28.png");
  });

  it("drops a keyword that has no latin letters", () => {
    expect(
      chartImageFilename({
        ...base,
        chart: "position-history",
        keyword: "タイマー",
      }),
    ).toBe("asobeast-position-history-focus-timer-2026-09-28-2026-10-28.png");
  });
});
