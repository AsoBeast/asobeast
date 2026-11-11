import { describe, expect, it } from "vitest";
import { positionTrendShape } from "./position-trend";

const on = (day: number, position: number | null) => ({
  date: `2026-11-${String(day).padStart(2, "0")}`,
  position,
});

describe("positionTrendShape", () => {
  it("draws a better position higher, across the seven days", () => {
    const shape = positionTrendShape([on(5, 9), on(8, 4), on(11, 1)]);

    expect(shape).toEqual({
      path: "M3 19L36 11L69 3",
      end: { x: 69, y: 3 },
      first: 9,
      last: 1,
    });
  });

  it("breaks the line where a check did not find the app", () => {
    const shape = positionTrendShape([
      on(5, 4),
      on(6, 4),
      on(7, null),
      on(10, 9),
      on(11, 9),
    ]);

    expect(shape?.path).toBe("M3 3L14 3M58 19L69 19");
  });

  it("keeps a flat week on the middle line", () => {
    expect(positionTrendShape([on(10, 7), on(11, 7)])?.path).toBe(
      "M58 11L69 11",
    );
  });

  it.each([
    ["no checks", []],
    ["one ranked check", [on(11, 3)]],
    ["one ranked check among misses", [on(10, null), on(11, 3)]],
    ["an absent list", undefined],
  ])("draws nothing for %s", (_case, checks) => {
    expect(positionTrendShape(checks)).toBeNull();
  });
});
