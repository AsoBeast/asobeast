import { describe, expect, it } from "vitest";
import type { AuditBenchmarkRow } from "@asobeast/shared";
import { benchmarkRatio, comparison } from "./benchmark-comparison";

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
