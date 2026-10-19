import { describe, expect, it } from "vitest";
import type { AuditBenchmarkRow } from "@asobeast/shared";
import {
  benchmarkRatio,
  comparison,
  formatBenchmarkValue,
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

describe("benchmarkRatio", () => {
  const withBest = (
    you: number | null,
    best: number | null,
    better: "higher" | "lower" = "higher",
  ): AuditBenchmarkRow => ({ ...row(you, 10, better), best });

  it.each([
    [withBest(450, 900), 0.5],
    [withBest(900, 900), 1],
    [withBest(0, 0), 1],
    [withBest(0, 0, "lower"), 1],
    [withBest(10, 5, "lower"), 0.5],
    [withBest(null, 900), 0],
    [withBest(10, null), 0],
  ])("reads %j as %s", (entry, expected) => {
    expect(benchmarkRatio(entry)).toBe(expected);
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
