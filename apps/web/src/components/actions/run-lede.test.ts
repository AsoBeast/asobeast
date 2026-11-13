import { describe, expect, it } from "vitest";
import type { ActionActivity, ActionActivityDay } from "@asobeast/shared";
import { ACTION_SUMMARY } from "../../../e2e/fixtures.mts";
import { ACTION_ACTIVITY } from "../../../e2e/action-details.mts";
import { runChanges } from "./run-lede";

const RUN_DAY = ACTION_SUMMARY.generatedAt!.slice(0, 10);

const QUIET: ActionActivityDay = {
  date: RUN_DAY,
  opened: 0,
  reopened: 0,
  done: 0,
  dismissed: 0,
  resolved: 0,
  verified: 0,
};

const activityOf = (day: Partial<ActionActivityDay>): ActionActivity => ({
  ...ACTION_ACTIVITY,
  days: [{ ...QUIET, ...day }],
});

describe("runChanges", () => {
  it("reads what the day of the last run opened and closed", () => {
    expect(runChanges(ACTION_SUMMARY, ACTION_ACTIVITY)).toEqual([
      "1 action opened",
      "1 was closed by you",
    ]);
  });

  it("counts reopened actions as opened and words each count", () => {
    expect(
      runChanges(
        ACTION_SUMMARY,
        activityOf({
          opened: 1,
          reopened: 1,
          done: 2,
          resolved: 2,
          verified: 1,
        }),
      ),
    ).toEqual([
      "2 actions opened",
      "2 were closed by you",
      "2 resolved on their own",
      "1 was confirmed fixed",
    ]);
  });

  it("is empty for a run that changed nothing or fell outside the window", () => {
    expect(runChanges(ACTION_SUMMARY, activityOf({}))).toEqual([]);
    expect(
      runChanges(ACTION_SUMMARY, activityOf({ date: "2020-01-01", opened: 3 })),
    ).toEqual([]);
  });

  it("is absent before the first generation", () => {
    expect(
      runChanges({ ...ACTION_SUMMARY, generatedAt: null }, ACTION_ACTIVITY),
    ).toBeNull();
  });
});
