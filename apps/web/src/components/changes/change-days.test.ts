import { describe, expect, it } from "vitest";
import type { ChangeEventItem } from "@asobeast/shared";
import { formatDate } from "@/lib/format";
import { groupChangesByDay } from "./change-days";

const TODAY = "2026-09-28";

const event = (id: string, capturedAt: string): ChangeEventItem => ({
  id,
  appId: "app-1",
  appName: "Focus Timer",
  isCompetitor: false,
  field: "title",
  before: "a",
  after: "b",
  capturedAt,
});

describe("groupChangesByDay", () => {
  it("labels today, yesterday and older days", () => {
    const groups = groupChangesByDay(
      [
        event("a", "2026-09-28T09:00:00.000Z"),
        event("b", "2026-09-27T23:59:00.000Z"),
        event("c", "2026-09-20T12:00:00.000Z"),
      ],
      TODAY,
    );

    expect(groups.map(({ day, label }) => ({ day, label }))).toEqual([
      { day: "2026-09-28", label: "Today" },
      { day: "2026-09-27", label: "Yesterday" },
      { day: "2026-09-20", label: formatDate("2026-09-20") },
    ]);
  });

  it("keeps the input order inside and across groups", () => {
    const groups = groupChangesByDay(
      [
        event("a", "2026-09-28T09:00:00.000Z"),
        event("b", "2026-09-28T08:00:00.000Z"),
        event("c", "2026-09-26T12:00:00.000Z"),
        event("d", "2026-09-26T11:00:00.000Z"),
      ],
      TODAY,
    );

    expect(groups.map((group) => group.events.map((item) => item.id))).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("returns no group for no events", () => {
    expect(groupChangesByDay([], TODAY)).toEqual([]);
  });

  it("reads today from its argument rather than the clock", () => {
    const [group] = groupChangesByDay(
      [event("a", "2026-01-02T09:00:00.000Z")],
      "2026-01-03",
    );

    expect(group.label).toBe("Yesterday");
  });
});
