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

  it("spreads thirty days ending on the frame's last day over the width", () => {
    const shape = positionTrendShape([on(1, 9), on(2, 9), on(30, 1)], {
      days: 30,
      end: "2026-11-30",
    });

    expect(shape).toEqual({
      path: "M3 19L5.3 19M69 3h0",
      end: { x: 69, y: 3 },
      first: 9,
      last: 1,
    });
  });

  it("places a paused keyword's checks on their own days, not at the end", () => {
    const shape = positionTrendShape([on(5, 9), on(6, 9), on(10, 4)], {
      days: 30,
      end: "2026-11-30",
    });

    expect(shape?.path).toBe("M12.1 19L14.4 19M23.5 3h0");
    expect(shape?.end).toEqual({ x: 23.5, y: 3 });
  });

  it("leaves out checks older than the frame", () => {
    const shape = positionTrendShape(
      [{ date: "2026-10-31", position: 50 }, on(1, 9), on(2, 4)],
      { days: 30, end: "2026-11-30" },
    );

    expect(shape?.first).toBe(9);
    expect(shape?.path).toBe("M3 19L5.3 3");
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
