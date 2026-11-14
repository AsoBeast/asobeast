import { describe, expect, it } from "vitest";
import type { ChangeEventItem } from "@asobeast/shared";
import { changesShownOn, dayShowing, timelineDays } from "./timeline-days";

const version = (
  day: string,
  after: string,
  rival = false,
): ChangeEventItem => ({
  id: `${day}-${after}-${rival}`,
  appId: rival ? "comp-1" : "app-1",
  appName: rival ? "Rival Focus" : "Focus Timer",
  isCompetitor: rival,
  field: "version",
  before: null,
  after,
  capturedAt: `${day}T12:00:00.000Z`,
});

const EVENTS = [
  version("2026-11-11", "2.6.0"),
  version("2026-11-10", "3.2", true),
  version("2026-11-03", "2.5.0"),
  version("2026-11-03", "3.1", true),
  version("2026-10-20", "3.0", true),
];

describe("timelineDays", () => {
  it("keeps each of your own versions on its day, newest day first", () => {
    const days = timelineDays(EVENTS);

    expect(days.map(({ day }) => day)).toEqual([
      "2026-11-11",
      "2026-11-10",
      "2026-11-03",
    ]);
    expect(days[0].entries).toEqual([{ kind: "event", event: EVENTS[0] }]);
    expect(days[2].entries).toEqual([{ kind: "event", event: EVENTS[2] }]);
  });

  it("folds a competitor's versions into one row on its newest day", () => {
    const [, newest] = timelineDays(EVENTS);

    expect(newest.entries).toHaveLength(1);
    expect(newest.entries[0]).toMatchObject({ kind: "versions" });
    expect(changesShownOn(newest)).toBe(1);
  });

  it("finds the day that shows a change folded into a newer row", () => {
    const days = timelineDays(EVENTS);

    expect(dayShowing(days, { appId: "comp-1", day: "2026-11-03" })).toBe(
      "2026-11-10",
    );
    expect(dayShowing(days, { appId: "app-1", day: "2026-11-03" })).toBe(
      "2026-11-03",
    );
    expect(dayShowing(days, { appId: "app-1", day: "2026-09-01" })).toBeNull();
  });
});
