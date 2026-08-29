import { describe, expect, it } from "vitest";
import type {
  StoreHealth,
  StoreHealthReport,
  StoreHealthState,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import { runDelayNotice } from "./run-delay-notice";
import { SCRAPER_BREAKAGE_URL, systemNotice } from "./system-notice";

function healthOf(
  states: Partial<Record<StoreHealth["store"], StoreHealthState>>,
): StoreHealthReport {
  const stores = Object.entries(states).map(([store, state]) => ({
    store: store as StoreHealth["store"],
    state: state as StoreHealthState,
    source: "canary" as const,
    since: "2026-08-28T02:00:00.000Z",
    checkedAt: "2026-08-28T08:00:00.000Z",
    detail: null,
  }));
  return {
    stores,
    degraded: stores.some((store) => store.state === "broken"),
  };
}

const DELAYED: WorkspaceRunStatus = {
  state: "delayed",
  startedAt: "2026-08-28T03:00:00.000Z",
  lastCaptureAt: "2026-08-28T04:00:00.000Z",
  tracked: 100,
  captured: 40,
  stores: [
    { store: "APP_STORE", tracked: 50, captured: 50 },
    { store: "GOOGLE_PLAY", tracked: 50, captured: 0 },
  ],
};

const ON_TIME: WorkspaceRunStatus = { ...DELAYED, state: "complete" };

describe("systemNotice", () => {
  it("says a break is on us, that data is untouched, and which store is paused", () => {
    const notice = systemNotice({
      stores: healthOf({ APP_STORE: "broken", GOOGLE_PLAY: "ok" }),
      run: ON_TIME,
    });

    expect(notice).toEqual({
      variant: "destructive",
      title: "App Store parsing looks broken",
      detail:
        "This is on us, not your setup. Your stored data is untouched and collection resumes on its own once we ship a fix. Until then, collection is paused for App Store.",
      href: SCRAPER_BREAKAGE_URL,
    });
  });

  it("lets a break outrank the delayed run it causes", () => {
    const notice = systemNotice({
      stores: healthOf({ APP_STORE: "broken" }),
      run: DELAYED,
    });

    expect(notice?.variant).toBe("destructive");
    expect(notice?.title).toBe("App Store parsing looks broken");
  });

  it("collapses both stores into one notice naming both", () => {
    const notice = systemNotice({
      stores: healthOf({ APP_STORE: "broken", GOOGLE_PLAY: "broken" }),
      run: ON_TIME,
    });

    expect(notice?.title).toBe(
      "App Store and Google Play parsing looks broken",
    );
    expect(notice?.detail).toContain("paused for App Store and Google Play");
  });

  it("passes a delayed run through unchanged when every store parses", () => {
    const notice = systemNotice({
      stores: healthOf({ APP_STORE: "ok", GOOGLE_PLAY: "ok" }),
      run: DELAYED,
    });
    const delay = runDelayNotice(DELAYED);

    expect(notice).toEqual({
      variant: "warning",
      title: delay?.title,
      detail: delay?.detail,
      href: null,
    });
  });

  it.each(["unreachable", "unknown"] as const)(
    "says nothing about %s, which the user cannot act on",
    (state) => {
      expect(
        systemNotice({ stores: healthOf({ APP_STORE: state }), run: ON_TIME }),
      ).toBeNull();
    },
  );

  it("says nothing while everything is healthy", () => {
    expect(
      systemNotice({ stores: healthOf({ APP_STORE: "ok" }), run: ON_TIME }),
    ).toBeNull();
  });

  it("says nothing while either query is still in flight", () => {
    expect(systemNotice({ stores: undefined, run: undefined })).toBeNull();
    expect(systemNotice({ stores: undefined, run: DELAYED })?.variant).toBe(
      "warning",
    );
    expect(
      systemNotice({
        stores: healthOf({ APP_STORE: "broken" }),
        run: undefined,
      })?.variant,
    ).toBe("destructive");
  });
});
