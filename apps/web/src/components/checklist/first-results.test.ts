import type { FirstRunStatus } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { firstResultsRow } from "./first-results";

type Stage = FirstRunStatus["stages"][number];

const stage = (
  name: Stage["stage"],
  overrides: Partial<Stage> = {},
): Stage => ({
  stage: name,
  ready: 8,
  total: 8,
  complete: true,
  expectedBy: null,
  ...overrides,
});

const status = (
  rankings: Partial<Stage> | null,
  complete = false,
): FirstRunStatus => ({
  appId: "app-1",
  complete,
  stages: [
    stage("metadata"),
    ...(rankings === null ? [] : [stage("rankings", rankings)]),
    stage("history", { ready: 2, total: 30, complete }),
  ],
});

describe("firstResultsRow", () => {
  it("shows nothing without an app", () => {
    expect(firstResultsRow(status({ complete: false }), null)).toBeNull();
  });

  it("shows nothing before the first read", () => {
    expect(firstResultsRow(undefined, "app-1")).toBeNull();
  });

  it("shows nothing when no keyword is tracked", () => {
    expect(
      firstResultsRow(status({ ready: 0, total: 0, complete: false }), "app-1"),
    ).toBeNull();
  });

  it("says the positions are being checked while rankings collect", () => {
    expect(
      firstResultsRow(status({ ready: 3, complete: false }), "app-1"),
    ).toEqual({ kind: "checking" });
  });

  it("says the positions are in once rankings finish and history builds", () => {
    expect(firstResultsRow(status({}), "app-1")).toEqual({
      kind: "ready",
      appId: "app-1",
    });
  });

  it("shows nothing once the first run is complete", () => {
    expect(firstResultsRow(status({}, true), "app-1")).toBeNull();
  });

  it("shows nothing for a status without a rankings stage", () => {
    expect(firstResultsRow(status(null), "app-1")).toBeNull();
  });
});
