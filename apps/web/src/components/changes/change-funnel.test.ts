import type { ChangeImpactFunnel, ChangeImpactReport } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { conversionChip, funnelByDay } from "./change-funnel";

const measured = (conversion: number): ChangeImpactFunnel => ({
  status: "measured",
  completeDays: 7,
  before: null,
  after: null,
  change: { impressions: 0, pageViews: 0, gets: 0.1, conversion },
});

const window = (days: 7 | 14 | 28, funnel?: ChangeImpactFunnel) => ({
  days,
  status: "measured" as const,
  targetDate: "2026-10-01",
  measuredOn: "2026-10-01",
  movement: null,
  medianPositionChange: null,
  visibilityBefore: null,
  visibilityAfter: null,
  visibilityChange: null,
  overlappingChanges: [],
  ...(funnel ? { funnel } : {}),
});

const report: ChangeImpactReport = {
  appId: "app-1",
  country: "us",
  days: 90,
  totalChanges: 2,
  items: [
    {
      changedOn: "2026-10-04",
      fields: ["title"],
      baselineDate: null,
      windows: [window(7, measured(0.161)), window(14, measured(0.5))],
    },
    {
      changedOn: "2026-09-01",
      fields: ["icon"],
      baselineDate: null,
      windows: [window(7)],
    },
  ],
};

describe("funnelByDay", () => {
  it("maps each change day to its seven day funnel block", () => {
    const byDay = funnelByDay(report);

    expect(byDay.get("2026-10-04")?.change?.conversion).toBe(0.161);
    expect(byDay.has("2026-09-01")).toBe(false);
  });
});

describe("conversionChip", () => {
  it("reads the relative change of conversion as a whole percentage", () => {
    expect(conversionChip(measured(0.161))).toBe(16);
    expect(conversionChip(measured(-0.054))).toBe(-5);
  });

  it("answers nothing for a window that is not measured", () => {
    expect(conversionChip({ ...measured(0.2), status: "pending" })).toBeNull();
    expect(conversionChip(undefined)).toBeNull();
    expect(
      conversionChip({
        ...measured(0.2),
        change: {
          impressions: null,
          pageViews: null,
          gets: null,
          conversion: null,
        },
      }),
    ).toBeNull();
  });
});
