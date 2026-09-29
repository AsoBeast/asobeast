import type { ActionListResult } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { actionItem } from "./action-test-item";
import { applyToList, listedStatuses } from "./optimistic-lists";

const list: ActionListResult = {
  items: [
    actionItem({ id: "a" }),
    actionItem({ id: "b" }),
    actionItem({ id: "c" }),
  ],
  total: 3,
  generatedAt: null,
};

describe("applyToList", () => {
  it("removes the changed rows from a list that no longer shows them", () => {
    const next = applyToList(list, ["OPEN", "SNOOZED"], new Set(["a", "c"]), {
      status: "DONE",
    });

    expect(next.items.map((item) => item.id)).toEqual(["b"]);
    expect(next.total).toBe(1);
  });

  it("updates the changed rows in place, in order, when the list still shows them", () => {
    const next = applyToList(list, ["OPEN", "SNOOZED"], new Set(["b"]), {
      status: "SNOOZED",
      snoozedUntil: "2026-08-15T00:00:00.000Z",
    });

    expect(next.items.map((item) => [item.id, item.status])).toEqual([
      ["a", "OPEN"],
      ["b", "SNOOZED"],
      ["c", "OPEN"],
    ]);
    expect(next.items[1].snoozedUntil).toBe("2026-08-15T00:00:00.000Z");
    expect(next.total).toBe(3);
  });
});

describe("listedStatuses", () => {
  it("reads the status filter of a list key, or the default", () => {
    expect(
      listedStatuses(["actions", "list", null, { status: ["DONE"] }]),
    ).toEqual(["DONE"]);
    expect(listedStatuses(["actions", "list", null, {}])).toEqual([
      "OPEN",
      "SNOOZED",
    ]);
  });
});
