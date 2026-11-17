import { describe, expect, it } from "vitest";
import { positionTrendShape } from "./position-trend";

const on = (day: number, position: number | null) => ({
  date: `2026-11-${String(day).padStart(2, "0")}`,
  position,
});

describe("positionTrendShape", () => {
  it("draws a better position higher, across the seven days", () => {
    const shape = positionTrendShape([
      on(5, 9),
      on(6, 9),
      on(7, 9),
      on(8, 4),
      on(9, 4),
      on(10, 4),
      on(11, 1),
    ]);

    expect(shape).toEqual({
      path: "M3 19L14 19L25 19L36 11L47 11L58 11L69 3",
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

  it("leaves a gap where a day has no check", () => {
    const shape = positionTrendShape([
      on(5, 4),
      on(6, 4),
      on(9, 9),
      on(10, 9),
      on(11, 9),
    ]);

    expect(shape?.path).toBe("M3 3L14 3M47 19L58 19L69 19");
  });

  it("marks a lone check between gaps as a dot", () => {
    const shape = positionTrendShape([on(5, 4), on(8, 9), on(11, 4)]);

    expect(shape?.path).toBe("M3 3h0M36 19h0M69 3h0");
  });

  it("spreads thirty days over the width and ignores older checks", () => {
    const day = (offset: number, position: number | null) => ({
      date: new Date(Date.UTC(2026, 9, 1 + offset)).toISOString().slice(0, 10),
      position,
    });
    const checks = [day(0, 50), day(1, 20), day(2, 20), day(30, 5), day(31, 5)];

    const shape = positionTrendShape(checks.slice(0, 3), 30);
    const recent = positionTrendShape(checks.slice(1), 30);

    expect(shape?.end.x).toBe(69);
    expect(recent?.first).toBe(20);
    expect(recent?.path.startsWith("M")).toBe(true);
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
