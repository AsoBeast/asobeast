import { describe, expect, it } from "vitest";
import { dayTicks, valueAxis, windowDays } from "./trend-axis";

const day = (offset: number): string =>
  new Date(Date.UTC(2026, 10, 6) - offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

describe("valueAxis", () => {
  it("fits whole steps around the figures with at most five ticks", () => {
    expect(valueAxis([44, 48, 63])).toEqual({
      domain: [40, 70],
      valueTicks: [40, 50, 60, 70],
    });
    expect(valueAxis([3, 8])).toEqual({
      domain: [2, 8],
      valueTicks: [2, 4, 6, 8],
    });
  });

  it("gives a flat line a band to sit in", () => {
    expect(valueAxis([50, 50]).domain).toEqual([50, 51]);
  });

  it("keeps to five ticks for counts in the thousands", () => {
    expect(valueAxis([300, 800])).toEqual({
      domain: [200, 800],
      valueTicks: [200, 400, 600, 800],
    });
    expect(valueAxis([0, 3200])).toEqual({
      domain: [0, 4000],
      valueTicks: [0, 1000, 2000, 3000, 4000],
    });
    expect(valueAxis([0, 61_000]).valueTicks).toEqual([
      0, 20_000, 40_000, 60_000, 80_000,
    ]);
  });

  it("spans the whole scale for figures far apart", () => {
    expect(valueAxis([4, 96])).toEqual({
      domain: [0, 100],
      valueTicks: [0, 25, 50, 75, 100],
    });
  });
});

describe("dayTicks", () => {
  it("labels every day of a week and whole weeks of a longer range", () => {
    expect(dayTicks(windowDays(day(0), 7))).toHaveLength(7);
    expect(dayTicks(windowDays(day(0), 30))).toEqual([
      day(28),
      day(21),
      day(14),
      day(7),
      day(0),
    ]);
    expect(dayTicks(windowDays(day(0), 90))).toEqual([
      day(84),
      day(63),
      day(42),
      day(21),
      day(0),
    ]);
  });
});
