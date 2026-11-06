import { describe, expect, it } from "vitest";
import type { PortfolioApp } from "@asobeast/shared";
import { portfolioVisibility } from "./visibility-series";

function app(
  id: string,
  current: number,
  points: Array<[string, number]>,
  overrides: Partial<PortfolioApp> = {},
): PortfolioApp {
  return {
    id,
    store: "APP_STORE",
    storeAppId: id,
    country: "us",
    name: id,
    iconUrl: null,
    groupId: null,
    groupName: null,
    visibility: { current, delta7d: null },
    sparkline: points.map(([date, visibility]) => ({ date, visibility })),
    trackedKeywords: 1,
    competitors: 0,
    lastCapturedAt: "2026-11-06T03:00:00.000Z",
    ...overrides,
  };
}

describe("portfolioVisibility", () => {
  it("charts the most visible apps and counts the rest", () => {
    const days = (value: number): Array<[string, number]> => [
      ["2026-11-04", value],
      ["2026-11-05", value],
    ];
    const apps = [
      app("a", 10, days(10)),
      app("b", 30, days(30)),
      app("c", 20, days(20)),
    ];
    const result = portfolioVisibility(apps, 2);
    expect(result.series.map((series) => series.appId)).toEqual(["b", "c"]);
    expect(result.omitted).toBe(1);
  });

  it("joins every app's days and leaves a missing day null", () => {
    const result = portfolioVisibility([
      app("a", 12, [
        ["2026-11-04", 11],
        ["2026-11-05", 12],
      ]),
      app("b", 8, [
        ["2026-11-03", 7],
        ["2026-11-05", 8],
      ]),
    ]);
    expect(result.rows).toEqual([
      { date: "2026-11-03", app0: null, app1: 7 },
      { date: "2026-11-04", app0: 11, app1: null },
      { date: "2026-11-05", app0: 12, app1: 8 },
    ]);
    expect(result.days).toBe(2);
  });

  it("needs the history in one app, not across apps", () => {
    const result = portfolioVisibility([
      app("a", 12, [
        ["2026-11-01", 11],
        ["2026-11-02", 12],
      ]),
      app("b", 8, [
        ["2026-11-03", 8],
        ["2026-11-04", 9],
      ]),
    ]);
    expect(result.rows).toHaveLength(4);
    expect(result.days).toBe(2);
  });

  it("leaves out an app without a capture or a line to draw", () => {
    const result = portfolioVisibility([
      app("a", 0, [], {}),
      app(
        "b",
        0,
        [
          ["2026-11-04", 0],
          ["2026-11-05", 0],
        ],
        {
          lastCapturedAt: null,
        },
      ),
      app("d", 50, [["2026-11-05", 50]]),
      app("c", 5, [
        ["2026-11-04", 4],
        ["2026-11-05", 5],
      ]),
    ]);
    expect(result.series.map((series) => series.appId)).toEqual(["c"]);
    expect(result.omitted).toBe(0);
  });

  it("names the market when two charted apps share a name", () => {
    const result = portfolioVisibility([
      app(
        "a",
        9,
        [
          ["2026-11-04", 9],
          ["2026-11-05", 9],
        ],
        { name: "Focus", country: "us" },
      ),
      app(
        "b",
        4,
        [
          ["2026-11-04", 4],
          ["2026-11-05", 4],
        ],
        { name: "Focus", country: "de" },
      ),
      app(
        "c",
        2,
        [
          ["2026-11-04", 2],
          ["2026-11-05", 2],
        ],
        { name: "Tomato" },
      ),
    ]);
    expect(result.series.map((series) => series.label)).toEqual([
      "Focus · US",
      "Focus · DE",
      "Tomato",
    ]);
  });

  it("names the store when one app is charted from both stores", () => {
    const result = portfolioVisibility([
      app(
        "a",
        9,
        [
          ["2026-11-04", 9],
          ["2026-11-05", 9],
        ],
        { name: "Focus" },
      ),
      app(
        "b",
        4,
        [
          ["2026-11-04", 4],
          ["2026-11-05", 4],
        ],
        {
          name: "Focus",
          store: "GOOGLE_PLAY",
        },
      ),
    ]);
    expect(result.series.map((series) => series.label)).toEqual([
      "Focus · App Store",
      "Focus · Google Play",
    ]);
  });
});
