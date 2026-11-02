import { describe, expect, it } from "vitest";
import { compareLabel, movementSortValue } from "./movement";

describe("movementSortValue", () => {
  it("puts new entries first, then the biggest climbs, and rows without a comparison last", () => {
    const values = [
      movementSortValue({ movement: "down", delta: 4, previous: 1 }),
      movementSortValue({ movement: "none", delta: null, previous: null }),
      movementSortValue({ movement: "up", delta: -9, previous: 10 }),
      movementSortValue({ movement: "new", delta: null, previous: null }),
      movementSortValue({ movement: "same", delta: 0, previous: 2 }),
    ];

    expect([...values].sort((a, b) => a - b)).toEqual([
      Number.NEGATIVE_INFINITY,
      -9,
      0,
      4,
      Number.POSITIVE_INFINITY,
    ]);
  });
});

describe("compareLabel", () => {
  it("names the comparison day", () => {
    expect(
      compareLabel("7d", {
        date: "2026-10-06",
        depth: 100,
        capturedAt: "2026-10-06T03:00:00.000Z",
      }),
    ).toBe("vs Oct 6");
  });

  it("says when the window has no capture", () => {
    expect(compareLabel("30d", null)).toBe("vs 30 days ago, none captured");
  });
});
