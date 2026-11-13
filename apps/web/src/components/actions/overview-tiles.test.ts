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
  it("counts the open actions by their open priorities with the week's net change", () => {
    expect(tiles().Open).toEqual({
      label: "Open",
      value: String(ACTION_SUMMARY.open),
      note: `${ACTION_SUMMARY.openByPriority.critical} critical · ${ACTION_SUMMARY.openByPriority.high} high`,
      delta: "+1 this week",
    });
  });

  it("leaves the net change out of a week that opened as many as it closed", () => {
    const quiet = {
      ...ACTION_ACTIVITY,
      days: ACTION_ACTIVITY.days.slice(0, 1),
    };

    expect(overviewTiles(ACTION_SUMMARY, quiet, ACTIONS)[0]).not.toHaveProperty(
      "delta",
    );
  });

  it("sums the openings of the last seven days against the week before", () => {
    const opened = (days: typeof ACTION_ACTIVITY.days) =>
      days.reduce((sum, day) => sum + day.opened + day.reopened, 0);
    const week = opened(ACTION_ACTIVITY.days.slice(-7));
    const before = opened(ACTION_ACTIVITY.days.slice(-14, -7));

    expect(tiles()["New this week"]).toEqual({
      label: "New this week",
      value: String(week),
      note: `${before} the week before`,
      delta: `+${week - before}`,
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
