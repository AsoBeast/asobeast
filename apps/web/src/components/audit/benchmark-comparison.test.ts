import { describe, expect, it } from "vitest";
import type { AuditBenchmarkRow } from "@asobeast/shared";
import {
  comparison,
  formatBenchmarkValue,
  medianGap,
} from "./benchmark-comparison";

const row = (
  you: number | null,
  median: number | null,
  better: "higher" | "lower" = "higher",
): AuditBenchmarkRow => ({
  metric: "rating-count",
  label: "Ratings",
  better,
  you,
  median,
  best: 900,
  bestAppId: "c1",
});

describe("comparison", () => {
  it.each([
    [row(341, 300), "ahead"],
    [row(200, 300), "behind"],
    [row(300, 300), "even"],
    [row(12, 20, "lower"), "ahead"],
    [row(40, 20, "lower"), "behind"],
    [row(null, 300), "unknown"],
    [row(341, null), "unknown"],
  ])("reads %j as %s", (entry, expected) => {
    expect(comparison(entry)).toBe(expected);
  });
});

describe("formatBenchmarkValue", () => {
  it.each([
    ["rating-average", 4.68104, "4.7"],
    ["rating-average", 4.65226, "4.7"],
    ["rating-average", 4.76438, "4.8"],
    ["rating-count", 30853, "30,853"],
    ["rating-count", 17322322, "17,322,322"],
    ["rating-count", 328427.5, "328,427.5"],
    ["screenshots", 8, "8"],
    ["days-since-update", 1234, "1,234"],
    ["has-video", 1, "1"],
    ["title-length", 12.5, "12.5"],
  ] as const)("writes %s %s as %s", (metric, value, text) => {
    expect(formatBenchmarkValue(metric, value)).toBe(text);
  });

  it.each(["rating-average", "rating-count", "screenshots"] as const)(
    "writes a missing %s as a dash",
    (metric) => {
      expect(formatBenchmarkValue(metric, null)).toBe("—");
    },
  );
});

describe("medianGap", () => {
  it("signs the distance from the competitor median", () => {
    expect(medianGap(row(30853, 328427))).toBe("-297,574");
    expect(medianGap(row(8, 6))).toBe("+2");
    expect(medianGap(row(12, 20, "lower"))).toBe("-8");
  });

  it("keeps two decimals for a rating", () => {
    expect(
      medianGap({ ...row(4.68104, 4.65226), metric: "rating-average" }),
    ).toBe("+0.03");
    expect(medianGap({ ...row(4.651, 4.652), metric: "rating-average" })).toBe(
      "0",
    );
  });

  it("has no gap without both figures", () => {
    expect(medianGap(row(null, 300))).toBeNull();
    expect(medianGap(row(300, null))).toBeNull();
    expect(medianGap(row(300, 300))).toBe("0");
  });
});
