import { describe, expect, it } from "vitest";
import type { AppRunStatus, RunState } from "@asobeast/shared";
import { formatDateTime } from "@/lib/format";
import {
  pillLabel,
  pillText,
  RUN_PROGRESS_POLL_MS,
  runAdvanced,
  runProgressInterval,
  runRows,
  startedSentence,
} from "./run-progress";

const status = (
  state: RunState,
  counts: [number, number][] = [
    [2, 4],
    [8, 40],
    [2, 2],
  ],
  paused?: boolean,
): AppRunStatus => ({
  appId: "app-1",
  date: "2026-10-15",
  state,
  startedAt: "2026-10-15T03:00:00.000Z",
  lastCaptureAt: null,
  stages: (["listings", "keywords", "categories"] as const).map(
    (stage, index) => ({
      stage,
      ready: counts[index][0],
      total: counts[index][1],
      complete: counts[index][0] >= counts[index][1],
    }),
  ),
  ...(paused === undefined ? {} : { paused }),
});

describe("the run progress pill", () => {
  it("W-RUN-01 words the pill per state", () => {
    expect(pillText(status("running"))).toBe("12 of 46");
    expect(pillText(status("complete"))).toBe("Run complete");
    expect(pillText(status("delayed"))).toBe("Run delayed");
    expect(pillText(status("idle"))).toBeNull();
    expect(pillLabel(status("running"))).toBe(
      "Today's run: 12 of 46 checks done",
    );
    expect(pillLabel(status("complete"))).toBe("Today's run complete");
    expect(pillLabel(status("delayed"))).toBe(
      "Today's run delayed: 12 of 46 checks done",
    );
  });

  it("W-RUN-02 labels the stages", () => {
    expect(
      runRows(
        status("running", [
          [1, 1],
          [12, 40],
          [0, 0],
        ]),
      ),
    ).toEqual([
      {
        stage: "listings",
        label: "Listings captured",
        ready: true,
        progress: null,
        detail: "Home and market listings of the app and its competitors.",
      },
      {
        stage: "keywords",
        label: "Positions checked",
        ready: false,
        progress: "12 of 40",
        detail: "Positions of the active keywords.",
      },
      {
        stage: "categories",
        label: "Charts read",
        ready: true,
        progress: null,
        detail: "Nothing to collect.",
      },
    ]);
  });

  it("W-RUN-03 polls only while running", () => {
    expect(runProgressInterval(status("running"))).toBe(RUN_PROGRESS_POLL_MS);
    expect(runProgressInterval(status("complete"))).toBe(false);
    expect(runProgressInterval(status("delayed"))).toBe(false);
    expect(runProgressInterval(status("idle"))).toBe(false);
    expect(runProgressInterval(undefined)).toBe(false);
  });

  it("W-RUN-04 sees a run advance", () => {
    const before = status("running");
    const after = status("running", [
      [2, 4],
      [9, 40],
      [2, 2],
    ]);

    expect(runAdvanced(before, after)).toBe(true);
    expect(runAdvanced(before, status("running"))).toBe(false);
    expect(runAdvanced(after, before)).toBe(false);
    expect(runAdvanced(undefined, after)).toBe(false);
    expect(runAdvanced(before, undefined)).toBe(false);
  });

  it("W-RUN-05 formats the start time with the pinned clock", () => {
    expect(startedSentence(status("running"))).toBe(
      `Started ${formatDateTime("2026-10-15T03:00:00.000Z")}.`,
    );
  });
  it("W-RUN-06 hides the pill of a paused run that has not finished", () => {
    expect(pillText(status("running", undefined, true))).toBeNull();
    expect(pillText(status("delayed", undefined, true))).toBeNull();
  });

  it("W-RUN-07 keeps the pill of a run that finished before the pause", () => {
    expect(pillText(status("complete", undefined, true))).toBe("Run complete");
  });

  it("W-RUN-08 does not poll a paused run", () => {
    expect(runProgressInterval(status("running", undefined, true))).toBe(false);
    expect(runProgressInterval(status("complete", undefined, true))).toBe(
      false,
    );
    expect(runProgressInterval(status("running", undefined, false))).toBe(
      RUN_PROGRESS_POLL_MS,
    );
  });
});
