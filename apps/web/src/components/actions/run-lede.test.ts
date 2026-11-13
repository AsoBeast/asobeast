import { describe, expect, it } from "vitest";
import type { ActionActivity, ActionActivityDay } from "@asobeast/shared";
import { ACTION_SUMMARY } from "../../../e2e/fixtures.mts";
import { ACTION_ACTIVITY } from "../../../e2e/action-details.mts";
import { runChanges } from "./run-lede";

if (ACTION_SUMMARY.generatedAt === null) {
  throw new Error("The action summary fixture was never generated");
}

const RUN_DAY = ACTION_SUMMARY.generatedAt.slice(0, 10);

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
  from: RUN_DAY,
  days: [{ ...QUIET, ...day }],
});

describe("runChanges", () => {
  it("reads what the day of the last run opened and closed", () => {
    expect(runChanges(ACTION_SUMMARY, ACTION_ACTIVITY)).toEqual({
      kind: "day",
      changes: ["1 action opened", "1 was closed by you"],
    });
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
    ).toEqual({
      kind: "day",
      changes: [
        "2 actions opened",
        "2 were closed by you",
        "2 resolved on their own",
        "1 was confirmed fixed",
      ],
    });
  });

  it("is empty for a run day on which nothing opened or closed", () => {
    expect(runChanges(ACTION_SUMMARY, activityOf({}))).toEqual({
      kind: "day",
      changes: [],
    });
  });

  it("says the run is older than the activity it can read", () => {
    expect(
      runChanges(
        { ...ACTION_SUMMARY, generatedAt: "2020-01-01T03:00:00.000Z" },
        activityOf({ opened: 3 }),
      ),
    ).toEqual({ kind: "stale", days: 1 });
  });

  it("claims nothing about a run newer than the activity it was read with", () => {
    expect(
      runChanges(
        { ...ACTION_SUMMARY, generatedAt: "2099-01-01T03:00:00.000Z" },
        ACTION_ACTIVITY,
      ),
    ).toEqual({ kind: "unknown" });
  });

  it("is absent before the first generation", () => {
    expect(
      runChanges({ ...ACTION_SUMMARY, generatedAt: null }, ACTION_ACTIVITY),
    ).toEqual({ kind: "unknown" });
  });
});
