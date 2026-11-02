import { describe, expect, it } from "vitest";
import { buildChartCaption, dayRangeLabel } from "./caption";

const SERIES = [
  { label: "focus timer (US)", color: "var(--color-a)", dash: undefined },
  { label: "pomodoro (DE)", color: "var(--color-b)", dash: "6 3" },
];

const SOURCE = {
  title: "Keyword rank positions",
  appName: "Focus Timer",
  storeAppId: "123",
  store: "APP_STORE" as const,
  countries: ["us", "de", "us"],
  from: "2026-09-28",
  to: "2026-10-28",
  series: SERIES,
};

describe("dayRangeLabel", () => {
  it("names a window in UTC", () => {
    expect(dayRangeLabel("2026-09-28", "2026-10-28")).toBe(
      "Sep 28, 2026 to Oct 28, 2026 UTC",
    );
  });

  it("names a single day once", () => {
    expect(dayRangeLabel("2026-10-28", "2026-10-28")).toBe("Oct 28, 2026 UTC");
  });
});

describe("buildChartCaption", () => {
  it("joins the app, the store, each storefront once and the plotted days", () => {
    expect(buildChartCaption(SOURCE)).toEqual({
      title: "Keyword rank positions",
      subtitle:
        "Focus Timer · App Store · United States and Germany · Sep 28, 2026 to Oct 28, 2026 UTC",
      brand: "AsoBeast",
      series: SERIES,
    });
  });

  it("names the app by its store id when it has no name", () => {
    expect(buildChartCaption({ ...SOURCE, appName: null }).subtitle).toMatch(
      /^123 · App Store/,
    );
  });

  it("leaves the storefront out when the chart names none", () => {
    expect(buildChartCaption({ ...SOURCE, countries: [] }).subtitle).toBe(
      "Focus Timer · App Store · Sep 28, 2026 to Oct 28, 2026 UTC",
    );
  });

  it("names a Google Play app after its store", () => {
    expect(
      buildChartCaption({ ...SOURCE, store: "GOOGLE_PLAY", countries: ["us"] })
        .subtitle,
    ).toContain("Google Play · United States");
  });
});
