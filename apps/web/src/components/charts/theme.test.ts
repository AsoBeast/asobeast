import { describe, expect, it } from "vitest";
import { CHART_SERIES_COUNT, seriesColor, seriesDash } from "./theme";

describe("seriesColor", () => {
  it("gives every series slot its own token", () => {
    const colors = new Set(
      Array.from({ length: CHART_SERIES_COUNT }, (_, index) =>
        seriesColor(index),
      ),
    );
    expect(colors.size).toBe(CHART_SERIES_COUNT);
  });

  it("wraps past the last slot", () => {
    expect(seriesColor(CHART_SERIES_COUNT)).toBe(seriesColor(0));
  });
});

describe("seriesDash", () => {
  it("gives every series slot its own stroke pattern", () => {
    const dashes = Array.from({ length: CHART_SERIES_COUNT }, (_, index) =>
      seriesDash(index),
    );
    expect(new Set(dashes).size).toBe(CHART_SERIES_COUNT);
  });

  it("leaves the first series solid", () => {
    expect(seriesDash(0)).toBeUndefined();
  });

  it("wraps past the last slot", () => {
    expect(seriesDash(CHART_SERIES_COUNT)).toBe(seriesDash(0));
  });
});
