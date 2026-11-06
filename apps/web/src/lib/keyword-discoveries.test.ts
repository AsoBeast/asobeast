import type {
  KeywordDiscoveryChecks,
  KeywordDiscoveryItem,
  KeywordDiscoveryList,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  discoveriesHref,
  discoveriesLine,
  discoveryFooter,
  discoverySourceLabel,
  discoveryTabLabel,
  keywordDiscoveriesPollInterval,
  pendingChecksText,
  refreshedToast,
  trackedToast,
  unfitNotice,
  visibleDiscoveries,
  withoutDiscoveries,
} from "./keyword-discoveries";

const item = (
  keywordId: string,
  state: KeywordDiscoveryItem["state"],
): KeywordDiscoveryItem => ({
  keywordId,
  text: keywordId,
  country: "us",
  source: "title",
  position: state === "ranked" ? 4 : null,
  depth: 200,
  checkedOn: "2026-11-02",
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: 80,
  opportunity: null,
  state,
  recommended: true,
});

const CHECKS: KeywordDiscoveryChecks = {
  perWeek: 40,
  usedThisWeek: 12,
  pending: 0,
  checkedAt: "2026-11-03T08:00:00.000Z",
  nextRunAt: "2026-11-09T07:30:00.000Z",
};

const list = (
  items: KeywordDiscoveryItem[],
  overrides: Partial<KeywordDiscoveryList> = {},
): KeywordDiscoveryList => ({
  items,
  counts: {
    all: items.length,
    ranked: items.filter(({ state }) => state === "ranked").length,
    opportunity: items.filter(({ state }) => state === "opportunity").length,
  },
  autoTrackRanked: false,
  unfit: 0,
  checks: CHECKS,
  ...overrides,
});

const NOW = new Date("2026-11-06T15:00:00.000Z");

describe("keywordDiscoveriesPollInterval", () => {
  it("polls every fifteen seconds while checks are pending", () => {
    expect(
      keywordDiscoveriesPollInterval(
        list([], { checks: { ...CHECKS, pending: 3 } }),
        2,
      ),
    ).toBe(15_000);
  });

  it("stops without data, without pending checks and after forty fetches", () => {
    expect(keywordDiscoveriesPollInterval(undefined, 0)).toBe(false);
    expect(keywordDiscoveriesPollInterval(list([]), 0)).toBe(false);
    expect(
      keywordDiscoveriesPollInterval(
        list([], { checks: { ...CHECKS, pending: 3 } }),
        40,
      ),
    ).toBe(false);
  });
});

describe("visibleDiscoveries", () => {
  const items = [
    item("a", "open"),
    item("b", "ranked"),
    item("c", "opportunity"),
    item("d", "ranked"),
  ];

  it("keeps every row for all, in order", () => {
    expect(
      visibleDiscoveries(items, "all").map(({ keywordId }) => keywordId),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps the rows of one state, in order", () => {
    expect(
      visibleDiscoveries(items, "ranked").map(({ keywordId }) => keywordId),
    ).toEqual(["b", "d"]);
    expect(
      visibleDiscoveries(items, "opportunity").map(
        ({ keywordId }) => keywordId,
      ),
    ).toEqual(["c"]);
  });
});

describe("withoutDiscoveries", () => {
  const before = list(
    [item("a", "open"), item("b", "ranked"), item("c", "opportunity")],
    { autoTrackRanked: true, unfit: 1 },
  );

  it("removes the rows and lowers every count by their state", () => {
    const after = withoutDiscoveries(before, ["b", "c"]);

    expect(after.items.map(({ keywordId }) => keywordId)).toEqual(["a"]);
    expect(after.counts).toEqual({ all: 1, ranked: 0, opportunity: 0 });
    expect(after.unfit).toBe(0);
    expect(after.checks).toBe(before.checks);
    expect(after.items[0]).toBe(before.items[0]);
  });

  it("never goes below zero", () => {
    const after = withoutDiscoveries(
      { ...before, counts: { all: 0, ranked: 0, opportunity: 0 }, unfit: 0 },
      ["a", "b", "c"],
    );

    expect(after.counts).toEqual({ all: 0, ranked: 0, opportunity: 0 });
    expect(after.unfit).toBe(0);
  });

  it("ignores an id it does not hold", () => {
    expect(withoutDiscoveries(before, ["zzz"])).toEqual(before);
  });
});

describe("discoveryTabLabel", () => {
  it("names the count in one string", () => {
    expect(discoveryTabLabel({ all: 153, ranked: 28, opportunity: 4 })).toBe(
      "Discovered 153",
    );
    expect(discoveryTabLabel({ all: 0, ranked: 0, opportunity: 0 })).toBe(
      "Discovered 0",
    );
    expect(discoveryTabLabel(undefined)).toBe("Discovered");
  });
});

describe("discoverySourceLabel", () => {
  it.each([
    ["title", "APP_STORE", "Your title"],
    ["subtitle", "APP_STORE", "Your subtitle"],
    ["description", "APP_STORE", "Your description"],
    ["description", "GOOGLE_PLAY", "Your short description"],
    ["competitors", "APP_STORE", "Competitors"],
    ["reviews", "GOOGLE_PLAY", "Reviews"],
    ["popularity", "APP_STORE", "Apple popularity"],
    ["portfolio", "APP_STORE", "Your other apps"],
  ] as const)("labels %s on %s as %s", (source, store, label) => {
    expect(discoverySourceLabel(source, store)).toBe(label);
  });
});

describe("discoveryFooter", () => {
  it("says when the list was checked and what the week holds", () => {
    expect(discoveryFooter(CHECKS, NOW)).toBe(
      "Checked 3 days ago. 40 checks a week, 12 used; the next run is on Monday.",
    );
  });

  it("counts whole utc days", () => {
    expect(
      discoveryFooter(
        { ...CHECKS, checkedAt: "2026-11-05T23:59:00.000Z" },
        new Date("2026-11-06T00:01:00.000Z"),
      ),
    ).toMatch(/^Checked 1 day ago\./);
    expect(
      discoveryFooter(
        { ...CHECKS, checkedAt: "2026-11-06T01:00:00.000Z" },
        NOW,
      ),
    ).toMatch(/^Checked today\./);
  });

  it("says when the list was never checked", () => {
    expect(
      discoveryFooter({ ...CHECKS, checkedAt: null, usedThisWeek: 0 }, NOW),
    ).toBe("Not checked yet. 40 checks a week; the next run is on Monday.");
  });

  it("says when the weekly runs are off", () => {
    expect(discoveryFooter({ ...CHECKS, nextRunAt: null }, NOW)).toBe(
      "Checked 3 days ago. 40 checks a week, 12 used. Weekly runs are off.",
    );
  });

  it("names a single check", () => {
    expect(
      discoveryFooter({ ...CHECKS, perWeek: 1, usedThisWeek: 1 }, NOW),
    ).toBe(
      "Checked 3 days ago. 1 check a week, 1 used; the next run is on Monday.",
    );
  });
});

describe("pendingChecksText", () => {
  it("counts the pending checks", () => {
    expect(pendingChecksText(0)).toBe("");
    expect(pendingChecksText(1)).toBe("1 check pending");
    expect(pendingChecksText(3)).toBe("3 checks pending");
  });
});

describe("unfitNotice", () => {
  it("counts what did not fit", () => {
    expect(unfitNotice(0)).toBe("");
    expect(unfitNotice(1)).toBe("1 did not fit your plan");
    expect(unfitNotice(12)).toBe("12 did not fit your plan");
  });
});

describe("trackedToast", () => {
  it("says what was tracked and what did not fit", () => {
    expect(trackedToast({ tracked: 16, skipped: 0 })).toBe(
      "Tracking 16 keywords",
    );
    expect(trackedToast({ tracked: 1, skipped: 0 })).toBe("Tracking 1 keyword");
    expect(trackedToast({ tracked: 16, skipped: 12 })).toBe(
      "Tracking 16 keywords. 12 did not fit your plan.",
    );
    expect(trackedToast({ tracked: 0, skipped: 12 })).toBe(
      "Nothing fit your plan",
    );
    expect(trackedToast({ tracked: 0, skipped: 0 })).toBe(
      "Nothing new to track",
    );
  });
});

describe("refreshedToast", () => {
  it("says what the refresh queued", () => {
    expect(refreshedToast({ queued: 40, resolved: 0 })).toBe(
      "Queued 40 checks",
    );
    expect(refreshedToast({ queued: 1, resolved: 3 })).toBe("Queued 1 check");
    expect(refreshedToast({ queued: 0, resolved: 2 })).toBe(
      "No checks to queue this week. The list was refreshed from other searches.",
    );
    expect(refreshedToast({ queued: 0, resolved: 0 })).toBe(
      "Nothing new to check this week",
    );
  });
});

describe("discoveriesLine", () => {
  it("counts the discoveries and the ranked ones", () => {
    expect(discoveriesLine({ open: 153, ranked: 28 })).toBe(
      "153 keyword discoveries, 28 where you already rank",
    );
    expect(discoveriesLine({ open: 1, ranked: 1 })).toBe(
      "1 keyword discovery, 1 where you already rank",
    );
    expect(discoveriesLine({ open: 5, ranked: 0 })).toBe(
      "5 keyword discoveries",
    );
    expect(discoveriesLine({ open: 1234, ranked: 0 })).toBe(
      "1,234 keyword discoveries",
    );
  });

  it("says nothing without a discovery", () => {
    expect(discoveriesLine({ open: 0, ranked: 0 })).toBeNull();
    expect(discoveriesLine(undefined)).toBeNull();
  });
});

describe("discoveriesHref", () => {
  it("opens the discovered tab, in a market when one is named", () => {
    expect(discoveriesHref("app-1")).toBe(
      "/apps/app-1/keywords?tab=discovered",
    );
    expect(discoveriesHref("app-1", "de")).toBe(
      "/apps/app-1/keywords?tab=discovered&country=de",
    );
  });
});
