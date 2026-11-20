import { describe, expect, it } from "vitest";
import { formatNumber } from "@/lib/format";
import { divergingTrend, fallen } from "./diverging-trend";

describe("fallen", () => {
  const trend = divergingTrend(
    [
      { date: "2026-07-01", up: 2, down: 0 },
      { date: "2026-07-02", up: 1, down: 3 },
    ],
    7,
  );
  const [quiet, busy] = trend.rows.slice(-2);

  it("reads a day on which nothing fell as 0, never as a signed zero", () => {
    expect(formatNumber(fallen(quiet))).toBe("0");
  });

  it("reads the count of a day on which keywords fell", () => {
    expect(formatNumber(fallen(busy))).toBe("3");
  });
});
