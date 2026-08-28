import { describe, expect, it } from "vitest";
import {
  FIRST_RUN_STAGES,
  type FirstRunStage,
  type FirstRunStageStatus,
  type FirstRunStatus,
} from "@asobeast/shared";
import { formatRelativeTime } from "@/lib/format";
import { firstRunHeadline, firstRunRows } from "./first-run-timeline";

const NOW = new Date("2026-08-10T09:00:00Z").getTime();
const TOMORROW = "2026-08-11T03:00:00.000Z";

const stage = (
  name: FirstRunStage,
  overrides: Partial<FirstRunStageStatus> = {},
): FirstRunStageStatus => ({
  stage: name,
  ready: 1,
  total: 1,
  complete: true,
  expectedBy: null,
  ...overrides,
});

const statusOf = (stages: FirstRunStageStatus[]): FirstRunStatus => ({
  appId: "app-1",
  complete: stages.every((row) => row.complete),
  stages,
});

const completeStatus = statusOf(FIRST_RUN_STAGES.map((name) => stage(name)));

const rowFor = (status: FirstRunStatus, name: FirstRunStage) => {
  const found = firstRunRows(status, NOW).find((row) => row.stage === name);
  if (!found) throw new Error(`missing row ${name}`);
  return found;
};

describe("firstRunRows", () => {
  it("marks every row ready for a fully collected app", () => {
    const rows = firstRunRows(completeStatus, NOW);

    expect(rows).toHaveLength(FIRST_RUN_STAGES.length);
    expect(rows.every((row) => row.state === "ready")).toBe(true);
  });

  it("returns the rows in the order the api gave them", () => {
    const shuffled = [...FIRST_RUN_STAGES].reverse().map((name) => stage(name));

    expect(
      firstRunRows(statusOf(shuffled), NOW).map((row) => row.stage),
    ).toEqual([...FIRST_RUN_STAGES].reverse());
  });

  it("hides progress at one of one and shows it otherwise", () => {
    const status = statusOf([
      stage("metadata"),
      stage("rankings", { ready: 4, total: 15, complete: false }),
    ]);

    expect(rowFor(status, "metadata").progress).toBeNull();
    expect(rowFor(status, "rankings").progress).toBe("4 of 15");
  });

  it("hides progress for a stage that expects nothing", () => {
    const status = statusOf([stage("reviews", { ready: 0, total: 0 })]);

    expect(rowFor(status, "reviews").progress).toBeNull();
  });

  it("names the expected time on a waiting rankings row", () => {
    const status = statusOf([
      stage("rankings", {
        ready: 0,
        total: 15,
        complete: false,
        expectedBy: TOMORROW,
      }),
    ]);

    expect(rowFor(status, "rankings").detail).toContain(
      formatRelativeTime(TOMORROW, NOW),
    );
  });

  it("says collection is queued rather than guessing a time", () => {
    const status = statusOf([
      stage("rankings", {
        ready: 0,
        total: 15,
        complete: false,
        expectedBy: null,
      }),
    ]);
    const detail = rowFor(status, "rankings").detail;

    expect(detail).toContain("queued rather than scheduled");
    expect(detail).not.toContain("in ");
    expect(detail).not.toMatch(/\d/);
  });

  it("sends unscored keywords to the weekly run rather than promising five", () => {
    const status = statusOf([
      stage("scores", {
        ready: 2,
        total: 15,
        complete: false,
        expectedBy: "2026-08-16T04:00:00.000Z",
      }),
    ]);
    const detail = rowFor(status, "scores").detail;

    expect(detail).toContain("queued for scoring at import");
    expect(detail).toContain("weekly run");
  });

  it("explains that the trend rules need a week before the queue reads well", () => {
    const status = statusOf([
      stage("history", { ready: 2, total: 7, complete: false }),
    ]);

    expect(rowFor(status, "history").detail).toContain(
      "week of daily captures",
    );
  });

  it("says the backfill is running while reviews are waiting", () => {
    const status = statusOf([
      stage("reviews", { ready: 0, total: 1, complete: false }),
    ]);

    expect(rowFor(status, "reviews").detail).toBe(
      "The review backfill is running.",
    );
  });

  it("never claims collected work for a stage that expects nothing", () => {
    const status = statusOf([
      stage("reviews", { ready: 0, total: 0 }),
      stage("keywords", { ready: 0, total: 0 }),
    ]);

    expect(rowFor(status, "reviews").detail).toContain("has no ratings");
    expect(rowFor(status, "keywords").detail).toContain(
      "No keywords are tracked",
    );
  });

  it("labels every stage in the contract", () => {
    const labels = firstRunRows(completeStatus, NOW).map((row) => row.label);

    expect(labels).toEqual([
      "Listing captured",
      "Keywords tracked",
      "Positions collected",
      "Traffic and difficulty scored",
      "Reviews backfilled",
      "Daily history",
    ]);
  });
});

describe("firstRunHeadline", () => {
  it("counts the stages still waiting, not the stages there are", () => {
    const status = statusOf([
      stage("metadata"),
      stage("keywords"),
      stage("rankings", { complete: false }),
      stage("scores", { complete: false }),
    ]);

    expect(firstRunHeadline(status)).toBe("2 steps are still finishing.");
  });

  it("reads as one step in the singular", () => {
    const status = statusOf([
      stage("metadata"),
      stage("rankings", { complete: false }),
    ]);

    expect(firstRunHeadline(status)).toBe("One step is still finishing.");
  });

  it("says so when nothing is left to wait for", () => {
    expect(firstRunHeadline(completeStatus)).toBe(
      "This app is fully collected.",
    );
  });
});
