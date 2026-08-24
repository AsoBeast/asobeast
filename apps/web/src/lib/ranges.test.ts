import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RANGE_PRESETS,
  RATINGS_RANGES,
  VISIBILITY_RANGES,
  presetToRange,
} from "./ranges";

const ALL_PRESETS = [
  ...new Set([...RANGE_PRESETS, ...VISIBILITY_RANGES, ...RATINGS_RANGES]),
];

describe("presetToRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("at a mid day utc instant", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-31T12:00:00.000Z"));
    });

    it.each([
      ["7d", "2026-03-24"],
      ["30d", "2026-03-01"],
      ["90d", "2025-12-31"],
      ["180d", "2025-10-02"],
    ] as const)("starts %s at %s", (preset, from) => {
      expect(presetToRange(preset).from).toBe(from);
    });

    it.each(ALL_PRESETS)("ends %s on the current utc date", (preset) => {
      expect(presetToRange(preset).to).toBe("2026-03-31");
    });

    it.each(ALL_PRESETS)("spans exactly the %s window", (preset) => {
      const days = Number(preset.replace("d", ""));
      const { from, to } = presetToRange(preset);
      const span =
        (Date.parse(`${to}T00:00:00.000Z`) -
          Date.parse(`${from}T00:00:00.000Z`)) /
        86_400_000;
      expect(span).toBe(days);
    });
  });

  it("uses the utc date when the local date is already tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T23:59:59.000Z"));
    expect(presetToRange("30d")).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });

  it("uses the utc date when the local date is still yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T00:00:00.000Z"));
    expect(presetToRange("30d")).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });

  it("crosses a leap day without drifting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2028-03-01T06:00:00.000Z"));
    expect(presetToRange("7d").from).toBe("2028-02-23");
  });
});

describe("range presets", () => {
  it.each(ALL_PRESETS)("declares %s as a whole number of days", (preset) => {
    expect(preset).toMatch(/^\d+d$/);
  });

  it("offers visibility and ratings ranges that the chart presets also cover", () => {
    expect(RANGE_PRESETS).toContain(VISIBILITY_RANGES[0]);
    expect(RATINGS_RANGES.slice(0, 2)).toEqual([...VISIBILITY_RANGES]);
  });
});
