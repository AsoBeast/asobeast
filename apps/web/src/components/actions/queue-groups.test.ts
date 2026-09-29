import { describe, expect, it } from "vitest";
import { actionItem } from "./action-test-item";
import { groupQueue, sortQueue } from "./queue-groups";

const ITEMS = [
  actionItem({
    id: "low-old",
    priority: "low",
    impact: 20,
    category: "hygiene",
    firstSeenAt: "2026-07-01T00:00:00.000Z",
  }),
  actionItem({
    id: "crit",
    priority: "critical",
    impact: 88,
    firstSeenAt: "2026-07-10T00:00:00.000Z",
  }),
  actionItem({
    id: "high-new",
    priority: "high",
    impact: 61,
    firstSeenAt: "2026-07-25T00:00:00.000Z",
    scope: { appId: "app-2", appName: "Calm Notes" },
  }),
  actionItem({
    id: "high-tie",
    priority: "high",
    impact: 61,
    firstSeenAt: "2026-07-25T00:00:00.000Z",
    status: "SNOOZED",
    scope: { appId: "app-2", appName: "Calm Notes" },
  }),
];

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("sortQueue", () => {
  it("sorts by impact, then age, then id, like the api", () => {
    expect(ids(sortQueue(ITEMS, "impact"))).toEqual([
      "crit",
      "high-new",
      "high-tie",
      "low-old",
    ]);
  });

  it("sorts the newest and the oldest first", () => {
    expect(ids(sortQueue(ITEMS, "newest"))).toEqual([
      "high-new",
      "high-tie",
      "crit",
      "low-old",
    ]);
    expect(ids(sortQueue(ITEMS, "oldest"))).toEqual([
      "low-old",
      "crit",
      "high-new",
      "high-tie",
    ]);
  });
});

describe("groupQueue", () => {
  it("groups by priority from critical to low and drops empty groups", () => {
    const groups = groupQueue(sortQueue(ITEMS, "impact"), "priority");

    expect(groups.map((group) => [group.label, ids(group.items)])).toEqual([
      ["Critical", ["crit"]],
      ["High", ["high-new", "high-tie"]],
      ["Low", ["low-old"]],
    ]);
  });

  it("groups by category in the shared category order", () => {
    expect(groupQueue(ITEMS, "category").map((group) => group.key)).toEqual([
      "metadata",
      "hygiene",
    ]);
  });

  it("groups by app by open count, then by name", () => {
    const groups = groupQueue(ITEMS, "app");

    expect(groups.map((group) => group.label)).toEqual([
      "Focus Timer · US",
      "Calm Notes · US",
    ]);
  });

  it("keeps the sorted order inside a group", () => {
    const [high] = groupQueue(sortQueue(ITEMS, "newest"), "priority").filter(
      (group) => group.key === "high",
    );

    expect(ids(high.items)).toEqual(["high-new", "high-tie"]);
  });
});
