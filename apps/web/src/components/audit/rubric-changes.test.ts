import { describe, expect, it } from "vitest";
import type { AuditScorePoint } from "@asobeast/shared";
import { labelPosition, rubricChanges } from "./rubric-changes";

const point = (overrides: Partial<AuditScorePoint> = {}): AuditScorePoint => ({
  date: "2026-11-01",
  overall: 72,
  coveredWeight: 95,
  totalWeight: 110,
  ...overrides,
});

describe("labelPosition", () => {
  it("puts the first change of a series on the left edge", () => {
    expect(labelPosition(0, 10)).toBe("insideLeft");
  });

  it("puts the last change of a series on the right edge", () => {
    expect(labelPosition(9, 10)).toBe("insideRight");
  });

  it("leaves the middle of a series without a pinned position", () => {
    expect(labelPosition(4, 10)).toBeNull();
    expect(labelPosition(5, 10)).toBeNull();
  });

  it("pins the label of a one point series to the right edge", () => {
    expect(labelPosition(0, 1)).toBe("insideRight");
  });
});

describe("rubricChanges", () => {
  it("marks one change between two versions with the position its index earns", () => {
    const points = [
      point({ date: "2026-11-01", rubricVersion: "v2" }),
      point({ date: "2026-11-02", rubricVersion: "v3" }),
      point({ date: "2026-11-03", rubricVersion: "v3" }),
    ];

    expect(rubricChanges(points)).toEqual([
      { date: "2026-11-02", version: "v3", labelPosition: null },
    ]);
  });

  it("keeps two changes on adjacent indexes from shifting each other", () => {
    const points = [
      point({ date: "2026-11-01", rubricVersion: "v1" }),
      point({ date: "2026-11-02", rubricVersion: "v2" }),
      point({ date: "2026-11-03", rubricVersion: "v3" }),
      ...Array.from({ length: 17 }, (_, index) =>
        point({
          date: `2026-11-${String(index + 4).padStart(2, "0")}`,
          rubricVersion: "v3",
        }),
      ),
    ];

    expect(rubricChanges(points)).toEqual([
      { date: "2026-11-02", version: "v2", labelPosition: "insideLeft" },
      { date: "2026-11-03", version: "v3", labelPosition: null },
    ]);
  });

  it("pins the label of a change on the only other point to the right edge", () => {
    const points = [
      point({ date: "2026-11-01", rubricVersion: "v2" }),
      point({ date: "2026-11-02", rubricVersion: "v3" }),
    ];

    expect(rubricChanges(points)).toEqual([
      { date: "2026-11-02", version: "v3", labelPosition: "insideRight" },
    ]);
  });
});
