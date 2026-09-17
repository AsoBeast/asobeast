import { describe, expect, it } from "vitest";
import type { AuditBenchmarkRow } from "@asobeast/shared";
import { comparison } from "./benchmark-comparison";

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
    [row(null, 300), "even"],
    [row(341, null), "even"],
  ])("reads %j as %s", (entry, expected) => {
    expect(comparison(entry)).toBe(expected);
  });
});
