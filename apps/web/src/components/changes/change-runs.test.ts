import { describe, expect, it } from "vitest";
import type { ChangeEventItem } from "@asobeast/shared";
import { collapseVersions } from "./change-runs";

function change(
  id: string,
  appId: string,
  field: ChangeEventItem["field"],
  capturedAt: string,
): ChangeEventItem {
  return {
    id,
    appId,
    appName: appId,
    isCompetitor: false,
    field,
    before: "1",
    after: "2",
    capturedAt,
  };
}

describe("collapseVersions", () => {
  it("keeps a lone version change as its own row", () => {
    const events = [
      change("1", "a", "title", "2026-11-06T03:00:00Z"),
      change("2", "a", "version", "2026-11-05T03:00:00Z"),
    ];
    expect(collapseVersions(events)).toEqual([
      { kind: "event", event: events[0] },
      { kind: "event", event: events[1] },
    ]);
  });

  it("folds every version change of one app into the row of its newest", () => {
    const events = [
      change("1", "a", "version", "2026-11-06T03:00:00Z"),
      change("2", "b", "version", "2026-11-05T03:00:00Z"),
      change("3", "a", "version", "2026-11-04T03:00:00Z"),
      change("4", "a", "subtitle", "2026-11-03T03:00:00Z"),
      change("5", "a", "version", "2026-11-02T03:00:00Z"),
    ];
    expect(collapseVersions(events)).toEqual([
      { kind: "versions", events: [events[0], events[2], events[4]] },
      { kind: "event", event: events[1] },
      { kind: "event", event: events[3] },
    ]);
  });

  it("keeps the versions of each market apart", () => {
    const events = [
      { ...change("1", "a", "version", "2026-11-06T03:00:00Z"), country: "us" },
      { ...change("2", "a", "version", "2026-11-05T03:00:00Z"), country: "de" },
    ];
    expect(collapseVersions(events).map((entry) => entry.kind)).toEqual([
      "event",
      "event",
    ]);
  });
});
