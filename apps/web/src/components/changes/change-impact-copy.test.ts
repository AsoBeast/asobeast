import { describe, expect, it } from "vitest";
import type { ChangeImpactMovement } from "@asobeast/shared";
import {
  impactScopeLine,
  measuredLine,
  movementLine,
  overlapNotice,
  rankingShiftLine,
  visibilityRange,
  windowStatusLine,
  windowTitle,
} from "./change-impact-copy";

const movement = (
  overrides: Partial<ChangeImpactMovement> = {},
): ChangeImpactMovement => ({
  improved: 2,
  declined: 1,
  unchanged: 1,
  entered: 0,
  exited: 0,
  measured: 4,
  ...overrides,
});

describe("windowStatusLine", () => {
  it.each([
    ["pending", null, "Measurable on Oct 2, 2026"],
    ["measured", "2026-09-30", "Measured on Sep 30, 2026"],
    ["unmeasured", null, "No rank check near Oct 2, 2026"],
  ] as const)("describes a %s window", (status, measuredOn, expected) => {
    expect(
      windowStatusLine({ status, targetDate: "2026-10-02", measuredOn }),
    ).toBe(expected);
  });
});

describe("movement lines", () => {
  it("counts the keywords that improved and declined", () => {
    expect(movementLine(movement())).toBe("2 improved, 1 declined");
  });

  it("names keywords that started or stopped ranking only when there are some", () => {
    expect(rankingShiftLine(movement())).toBeNull();
    expect(rankingShiftLine(movement({ entered: 1 }))).toBe(
      "1 started ranking",
    );
    expect(rankingShiftLine(movement({ entered: 1, exited: 2 }))).toBe(
      "1 started ranking, 2 stopped ranking",
    );
  });

  it("says how many keywords were checked on both days", () => {
    expect(measuredLine(movement({ measured: 1 }))).toBe(
      "1 keyword checked on both days",
    );
    expect(measuredLine(movement())).toBe("4 keywords checked on both days");
  });
});

describe("visibilityRange", () => {
  it("joins the visibility before and after", () => {
    expect(
      visibilityRange({ visibilityBefore: 38.4, visibilityAfter: 42 }),
    ).toBe("38.4 → 42");
  });

  it("has no range when a side is missing", () => {
    expect(
      visibilityRange({ visibilityBefore: null, visibilityAfter: 42 }),
    ).toBeNull();
    expect(
      visibilityRange({ visibilityBefore: 38.4, visibilityAfter: null }),
    ).toBeNull();
  });
});

describe("overlapNotice", () => {
  it("says nothing without a later change", () => {
    expect(overlapNotice([])).toBeNull();
  });

  it("names one later change", () => {
    expect(overlapNotice(["2026-09-18"])).toBe(
      "Another change on Sep 18, 2026 falls inside this window.",
    );
  });

  it("joins several later changes", () => {
    expect(overlapNotice(["2026-09-18", "2026-09-20"])).toBe(
      "Other changes on Sep 18, 2026 and Sep 20, 2026 fall inside this window.",
    );
  });
});

describe("impactScopeLine", () => {
  it.each([
    [
      { days: 90, totalChanges: 1, shown: 1 },
      "1 change to your listing in the last 90 days",
    ],
    [
      { days: 30, totalChanges: 4, shown: 4 },
      "4 changes to your listing in the last 30 days",
    ],
    [
      { days: 365, totalChanges: 15, shown: 12 },
      "The 12 newest of 15 changes to your listing in the last 365 days",
    ],
  ])("describes %o", (scope, expected) => {
    expect(impactScopeLine(scope)).toBe(expected);
  });
});

describe("windowTitle", () => {
  it("names a window by its length", () => {
    expect(windowTitle(7)).toBe("After 7 days");
  });
});
