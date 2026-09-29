import { describe, expect, it } from "vitest";
import { actionItem } from "./action-test-item";
import { workByApp, workByMarket } from "./work-by-scope";

const ITEMS = [
  actionItem({ id: "a", priority: "high" }),
  actionItem({ id: "b", priority: "low" }),
  actionItem({ id: "c", priority: "high", status: "SNOOZED" }),
  actionItem({
    id: "d",
    priority: "critical",
    scope: { appId: "app-2", appName: "Calm Notes", country: "de" },
  }),
  actionItem({
    id: "e",
    priority: "low",
    scope: { appId: "app-3", appName: "Zen Timer", country: "de" },
  }),
];

describe("workByApp", () => {
  it("counts the open actions of each app by priority", () => {
    const [, focus] = workByApp(ITEMS);

    expect(focus).toEqual({
      key: "app-1",
      label: "Focus Timer · US",
      counts: { critical: 0, high: 1, medium: 0, low: 1 },
      total: 2,
    });
  });

  it("leaves snoozed actions out", () => {
    expect(workByApp(ITEMS).reduce((sum, row) => sum + row.total, 0)).toBe(4);
  });

  it("orders by critical, then high, then total, then name", () => {
    expect(workByApp(ITEMS).map((row) => row.label)).toEqual([
      "Calm Notes · DE",
      "Focus Timer · US",
      "Zen Timer · DE",
    ]);
  });
});

describe("workByMarket", () => {
  it("groups the open actions by market name", () => {
    expect(workByMarket(ITEMS).map((row) => [row.label, row.total])).toEqual([
      ["Germany", 2],
      ["United States", 2],
    ]);
  });
});
