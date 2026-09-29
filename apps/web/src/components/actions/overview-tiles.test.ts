import { describe, expect, it } from "vitest";
import { ACTION_SUMMARY, ACTIONS } from "../../../e2e/fixtures.mts";
import { ACTION_ACTIVITY } from "../../../e2e/action-details.mts";
import { overviewTiles } from "./overview-tiles";

const tiles = (summary = ACTION_SUMMARY) =>
  Object.fromEntries(
    overviewTiles(summary, ACTION_ACTIVITY, ACTIONS).map((tile) => [
      tile.label,
      tile,
    ]),
  );

describe("overviewTiles", () => {
  it("counts the open actions by their open priorities", () => {
    expect(tiles().Open).toEqual({
      label: "Open",
      value: String(ACTION_SUMMARY.open),
      note: `${ACTION_SUMMARY.openByPriority.critical} critical · ${ACTION_SUMMARY.openByPriority.high} high`,
    });
  });

  it("sums the openings of the last seven days", () => {
    const week = ACTION_ACTIVITY.days.slice(-7);
    const opened = week.reduce(
      (sum, day) => sum + day.opened + day.reopened,
      0,
    );
    const resolved = week.reduce((sum, day) => sum + day.resolved, 0);

    expect(tiles()["New this week"]).toMatchObject({
      value: String(opened),
      note: `${resolved} resolved on their own`,
    });
    expect(tiles()["Confirmed fixed"]).toMatchObject({
      value: String(ACTION_ACTIVITY.totals.verified),
      note: `${ACTION_ACTIVITY.totals.done} marked done · 30 days`,
    });
  });

  it("names the earliest wake date of the snoozed actions", () => {
    expect(tiles().Snoozed).toMatchObject({
      value: "1",
      note: "next wakes Aug 15, 2026",
    });
  });

  it("shows a dash everywhere before the first generation", () => {
    const empty = overviewTiles(
      { ...ACTION_SUMMARY, generatedAt: null },
      ACTION_ACTIVITY,
      [],
    );

    expect(empty.every((tile) => tile.value === "—")).toBe(true);
    expect(empty.every((tile) => tile.note === "not generated yet")).toBe(true);
  });
});
