import { describe, expect, it } from "vitest";
import type { FirstRunStatus } from "@asobeast/shared";
import {
  alertsNudgeState,
  nudgeDismissalKey,
  readDismissed,
  writeDismissed,
  type NudgeInput,
} from "./alerts-nudge";

const status = (
  historyReady: number,
  rankingsComplete = true,
): FirstRunStatus => ({
  appId: "app-1",
  complete: rankingsComplete,
  stages: [
    {
      stage: "rankings",
      ready: 4,
      total: 4,
      complete: rankingsComplete,
      expectedBy: null,
    },
    {
      stage: "history",
      ready: historyReady,
      total: 7,
      complete: historyReady === 7,
      expectedBy: null,
    },
  ],
});

const READY: NudgeInput = {
  firstRun: status(2),
  channels: 0,
  emailEnabled: true,
  dismissed: false,
};

class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

const throwing = (): Storage => {
  throw new Error("storage is blocked");
};

describe("alertsNudgeState", () => {
  it("offers email once two captures are in and no channel exists", () => {
    expect(alertsNudgeState(READY)).toBe("email");
  });

  it("offers a webhook when the instance cannot send email", () => {
    expect(alertsNudgeState({ ...READY, emailEnabled: false })).toBe("webhook");
  });

  it.each([
    ["the first run has not loaded", { firstRun: undefined }],
    ["the channels have not loaded", { channels: undefined }],
    ["the alert config has not loaded", { emailEnabled: undefined }],
    ["the viewer dismissed it", { dismissed: true }],
    ["a channel exists", { channels: 1 }],
    ["one capture is in", { firstRun: status(1) }],
    ["the first positions are still collected", { firstRun: status(3, false) }],
  ])("stays hidden when %s", (_label, change) => {
    expect(alertsNudgeState({ ...READY, ...change })).toBe("hidden");
  });
});

describe("the dismissal", () => {
  it("is kept per app", () => {
    const storage = new MemoryStorage() as unknown as Storage;

    expect(writeDismissed(() => storage, "app-1")).toBe(true);

    expect(readDismissed(() => storage, "app-1")).toBe(true);
    expect(readDismissed(() => storage, "app-2")).toBe(false);
    expect(nudgeDismissalKey("app-1")).toBe("asobeast:alerts-nudge:app-1");
  });

  it("reads as not dismissed and reports the failure when storage throws", () => {
    expect(readDismissed(throwing, "app-1")).toBe(false);
    expect(writeDismissed(throwing, "app-1")).toBe(false);
  });
});
