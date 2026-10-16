import type {
  StoreFunnelPoint,
  StoreFunnelReport,
  StoreFunnelWindow,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  formatConversion,
  formatCount,
  funnelState,
  searchShare,
  trendValue,
  windowOf,
} from "./funnel";

const counts = (impressions: number | null, gets: number) => ({
  impressions,
  uniqueImpressions: impressions,
  pageViews: 10,
  gets,
  conversion: impressions ? gets / impressions : null,
});

const window = (
  days: 7 | 14 | 28,
  status: StoreFunnelWindow["status"],
): StoreFunnelWindow => ({
  days,
  status,
  from: "2026-09-16",
  to: "2026-10-13",
  current: status === "unmeasured" ? null : counts(1000, 30),
  previous: status === "measured" ? counts(800, 25) : null,
  change:
    status === "measured"
      ? { impressions: 0.25, pageViews: 0, gets: 0.18, conversion: -0.04 }
      : null,
});

const point = (
  date: string,
  total: number,
  search: number,
): StoreFunnelPoint => ({
  date,
  complete: true,
  total: counts(total, 1),
  search: counts(search, 1),
});

const REPORT: StoreFunnelReport = {
  appId: "app-1",
  store: "APP_STORE",
  country: null,
  connected: true,
  source: "appStoreConnect",
  days: 90,
  completeThrough: "2026-10-13",
  points: [
    point("2026-09-15", 1000, 1000),
    point("2026-09-16", 100, 60),
    point("2026-10-13", 100, 64),
    point("2026-10-14", 500, 0),
  ],
  windows: [
    window(7, "measured"),
    window(14, "measured"),
    window(28, "measured"),
  ],
};

describe("funnel helpers", () => {
  it("picks a window by its days", () => {
    expect(windowOf(REPORT, 28)?.days).toBe(28);
    expect(windowOf({ ...REPORT, windows: [] }, 28)).toBeNull();
  });

  it("formats counts and conversion", () => {
    expect(formatCount(12_345)).toBe("12,345");
    expect(formatCount(null)).toBe("—");
    expect(formatConversion(0.0312)).toBe("3.1%");
    expect(formatConversion(null)).toBe("—");
  });

  it("reads the search share of impressions inside a window", () => {
    expect(searchShare(REPORT, windowOf(REPORT, 28))).toBe(62);
    expect(searchShare(REPORT, null)).toBeNull();
    expect(
      searchShare({ ...REPORT, points: [] }, windowOf(REPORT, 28)),
    ).toBeNull();
  });

  it("turns a measured change into a percentage for a trend chip", () => {
    expect(trendValue(windowOf(REPORT, 7), "gets")).toBe(18);
    expect(trendValue(windowOf(REPORT, 7), "conversion")).toBe(-4);
    expect(trendValue(window(7, "pending"), "gets")).toBeNull();
    expect(trendValue(null, "gets")).toBeNull();
  });

  it("tells off, waiting and ready apart", () => {
    expect(funnelState({ ...REPORT, connected: false })).toBe("off");
    expect(
      funnelState({
        ...REPORT,
        windows: [
          window(7, "unmeasured"),
          window(14, "unmeasured"),
          window(28, "unmeasured"),
        ],
      }),
    ).toBe("waiting");
    expect(funnelState(REPORT)).toBe("ready");
  });
});
