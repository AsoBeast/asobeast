import { describe, expect, it } from "vitest";
import {
  ACTION_ACTIVITY,
  EMPTY_ACTION_ACTIVITY,
} from "../../../e2e/action-details.mts";
import { activeDays, activityRows, activityTotalsLine } from "./activity-chart";

describe("activityRows", () => {
  it("sums openings, closes by you and resolutions per day", () => {
    const rows = activityRows(ACTION_ACTIVITY);
    const day = ACTION_ACTIVITY.days.find((entry) => entry.reopened > 0)!;
    const row = rows.find((entry) => entry.date === day.date)!;

    expect(rows).toHaveLength(ACTION_ACTIVITY.days.length);
    expect(row).toEqual({
      date: day.date,
      opened: day.opened + day.reopened,
      closedByYou: day.done + day.dismissed,
      resolved: day.resolved,
    });
  });
});

describe("activityTotalsLine", () => {
  it("states the totals and the confirmed fixes over the window", () => {
    const { totals } = ACTION_ACTIVITY;

    expect(activityTotalsLine(ACTION_ACTIVITY)).toBe(
      `${totals.opened + totals.reopened} opened · ${totals.done + totals.dismissed} closed by you · ${totals.resolved} resolved on their own · ${totals.verified} confirmed fixed in 30 days`,
    );
  });
});

describe("activeDays", () => {
  it("counts the days with any change", () => {
    expect(activeDays(ACTION_ACTIVITY)).toBeGreaterThanOrEqual(6);
  });

  it("counts none for an empty window", () => {
    expect(activeDays(EMPTY_ACTION_ACTIVITY)).toBe(0);
  });
});
