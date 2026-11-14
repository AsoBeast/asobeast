import { describe, expect, it } from "vitest";
import type {
  ChangeImpactItem,
  ChangeImpactWindow,
  ChangeImpactWindowDays,
} from "@asobeast/shared";
import { changeEffect, effectLine, visibilityMove } from "./change-effects";

const window = (
  days: ChangeImpactWindowDays,
  fields: Partial<ChangeImpactWindow>,
): ChangeImpactWindow => ({
  days,
  status: "pending",
  targetDate: "2026-11-18",
  measuredOn: null,
  movement: null,
  medianPositionChange: null,
  visibilityBefore: null,
  visibilityAfter: null,
  visibilityChange: null,
  overlappingChanges: [],
  ...fields,
});

const item = (
  windows: ChangeImpactWindow[],
  baselineDate: string | null = "2026-11-10",
): ChangeImpactItem => ({
  changedOn: "2026-11-11",
  fields: ["title"],
  baselineDate,
  windows,
});

describe("changeEffect", () => {
  it("reads the shortest measured window", () => {
    const effect = changeEffect(
      item([
        window(28, { status: "measured", visibilityChange: 1.3 }),
        window(7, { status: "measured", visibilityChange: -2.3 }),
      ]),
    );

    expect(effect).toEqual({ kind: "measured", days: 7, change: -2.3 });
  });

  it("says when the first window becomes measurable", () => {
    expect(changeEffect(item([window(7, {}), window(14, {})]))).toEqual({
      kind: "pending",
      measurableOn: "2026-11-18",
    });
  });

  it("has no effect for a change without a rank check before it", () => {
    expect(changeEffect(item([window(7, {})], null))).toBeNull();
  });

  it("has no effect when no window can be measured", () => {
    expect(
      changeEffect(item([window(7, { status: "unmeasured" })])),
    ).toBeNull();
  });
});

describe("effectLine", () => {
  it("words a measured and a pending effect", () => {
    expect(effectLine({ kind: "measured", days: 7, change: 3.7 })).toBe(
      "Visibility up 3.7 after 7 days",
    );
    expect(effectLine({ kind: "pending", measurableOn: "2026-11-18" })).toBe(
      "Measurable on Nov 18",
    );
  });
});

describe("visibilityMove", () => {
  it("names the direction and leaves a flat change unsigned", () => {
    expect(visibilityMove(-2.3)).toBe("down 2.3");
    expect(visibilityMove(0)).toBe("unchanged");
  });
});
