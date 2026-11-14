import { describe, expect, it } from "vitest";
import type { StoreConnectionApp } from "@asobeast/shared";
import { coverageScale, coverageSpan, endsOnSync } from "./data-coverage";

const app = (
  firstDate: string | null,
  lastDate: string | null,
): StoreConnectionApp => ({
  appId: "app",
  name: "App",
  state: "requested",
  firstDate,
  lastDate,
});

describe("coverageScale", () => {
  it("runs from the earliest report day to the last sync", () => {
    expect(
      coverageScale(
        [app("2026-09-01", "2026-10-09"), app("2024-01-01", "2026-10-12")],
        "2026-10-15T05:31:00.000Z",
      ),
    ).toEqual({ from: "2024-01-01", to: "2026-10-15" });
  });

  it("ends on the newest report day when it is after the last sync", () => {
    expect(
      coverageScale([app("2026-09-01", "2026-10-20")], "2026-10-15T05:31:00Z"),
    ).toEqual({ from: "2026-09-01", to: "2026-10-20" });
  });

  it("ends on the newest report day without a sync", () => {
    expect(coverageScale([app("2026-09-01", "2026-10-09")], null)).toEqual({
      from: "2026-09-01",
      to: "2026-10-09",
    });
  });

  it("has no scale when no app has reported", () => {
    expect(coverageScale([app(null, null)], "2026-10-15T05:31:00Z")).toBeNull();
    expect(coverageScale([], null)).toBeNull();
  });
});

describe("coverageSpan", () => {
  const scale = { from: "2026-09-01", to: "2026-10-15" };

  it("counts both end days and leaves the lag after the bar", () => {
    const span = coverageSpan(app("2026-09-01", "2026-10-09"), scale);
    expect(span?.days).toBe(39);
    expect(span?.left).toBe(0);
    expect(span?.width).toBeCloseTo((39 / 45) * 100);
  });

  it("starts a later app after the scale's first day", () => {
    const span = coverageSpan(app("2026-10-01", "2026-10-15"), scale);
    expect(span?.days).toBe(15);
    expect(span?.left).toBeCloseTo((30 / 45) * 100);
    expect((span?.left ?? 0) + (span?.width ?? 0)).toBeCloseTo(100);
  });

  it("counts a single report day as one day", () => {
    expect(coverageSpan(app("2026-10-15", "2026-10-15"), scale)?.days).toBe(1);
  });

  it("draws nothing for an app without data, an inverted range or no scale", () => {
    expect(coverageSpan(app(null, null), scale)).toBeNull();
    expect(coverageSpan(app("2026-10-09", "2026-09-01"), scale)).toBeNull();
    expect(coverageSpan(app("2026-09-01", "2026-10-09"), null)).toBeNull();
  });
});

describe("endsOnSync", () => {
  const scale = { from: "2026-09-01", to: "2026-10-15" };

  it("is true when the scale ends on the day of the last sync", () => {
    expect(endsOnSync(scale, "2026-10-15T05:31:00.000Z")).toBe(true);
    expect(endsOnSync(scale, "2026-10-16T01:00:00+02:00")).toBe(true);
  });

  it("is false when a newer report day or no sync ends the scale", () => {
    expect(endsOnSync(scale, "2026-10-10T05:31:00.000Z")).toBe(false);
    expect(endsOnSync(scale, null)).toBe(false);
  });
});
