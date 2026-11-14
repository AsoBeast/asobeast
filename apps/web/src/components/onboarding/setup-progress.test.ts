import type { AppSetupSummary, PortfolioApp } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  activeKeywordCount,
  bannerApps,
  completedFacts,
  completionHint,
  keywordsStepDescription,
  nextLabel,
  progressPercent,
  progressValueLabel,
  progressSentence,
} from "./setup-progress";

describe("progressSentence", () => {
  it("names the app, the count and the next step", () => {
    expect(
      progressSentence("Focus Timer", { done: 1, total: 3, next: "keywords" }),
    ).toBe("Set up Focus Timer · 1 of 3 · next: track keywords");
  });

  it("says the setup is ready once no step is next", () => {
    expect(
      progressSentence("Focus Timer", { done: 3, total: 3, next: null }),
    ).toBe("Set up Focus Timer · 3 of 3 · ready to complete");
  });

  it("speaks of this app when the name is unknown", () => {
    expect(
      progressSentence(null, { done: 0, total: 3, next: "competitors" }),
    ).toBe("Set up this app · 0 of 3 · next: pick competitors");
  });
});

describe("nextLabel", () => {
  it("lowercases the step title", () => {
    expect(nextLabel("countries")).toBe("add countries");
  });
});

describe("progressValueLabel", () => {
  it("reads the progress as settled steps", () => {
    expect(progressValueLabel({ done: 2, total: 3, next: "countries" })).toBe(
      "2 of 3 steps",
    );
  });
});

describe("progressPercent", () => {
  it("measures the settled share of the steps", () => {
    expect(progressPercent({ done: 0, total: 3, next: "competitors" })).toBe(0);
    expect(progressPercent({ done: 3, total: 3, next: null })).toBe(100);
  });
});

describe("completedFacts", () => {
  it("counts what the app tracks and names the day it was completed", () => {
    expect(
      completedFacts({
        competitors: 1,
        keywords: 4,
        home: "us",
        markets: 2,
        completedAt: "2026-11-12T08:30:00.000Z",
      }),
    ).toEqual([
      "1 competitor",
      "4 keywords in United States",
      "2 countries",
      "completed Nov 12",
    ]);
  });

  it("leaves out a count that has not loaded and a missing day", () => {
    expect(
      completedFacts({
        competitors: null,
        keywords: null,
        home: "us",
        markets: 1,
        completedAt: null,
      }),
    ).toEqual(["1 country"]);
  });
});

describe("completionHint", () => {
  it("names every step that is neither done nor skipped", () => {
    expect(
      completionHint({
        competitors: "done",
        keywords: "open",
        countries: "loading",
      }),
    ).toBe("Finish or skip track keywords and add countries first.");
  });

  it("names the one step left", () => {
    expect(
      completionHint({
        competitors: "done",
        keywords: "skipped",
        countries: "open",
      }),
    ).toBe("Finish or skip add countries first.");
  });

  it("says nothing once every step is settled", () => {
    expect(
      completionHint({
        competitors: "done",
        keywords: "skipped",
        countries: "done",
      }),
    ).toBeNull();
  });
});

describe("activeKeywordCount", () => {
  it("counts only active keywords", () => {
    expect(
      activeKeywordCount([
        { active: true },
        { active: false },
        { active: true },
      ]),
    ).toBe(2);
  });
});

describe("bannerApps", () => {
  const app = (
    id: string,
    status: AppSetupSummary["status"],
    updatedAt: string | null,
  ): PortfolioApp => ({
    id,
    store: "APP_STORE",
    storeAppId: id,
    country: "us",
    name: id,
    iconUrl: null,
    groupId: null,
    groupName: null,
    visibility: { current: 0, delta7d: null },
    sparkline: [],
    trackedKeywords: 0,
    competitors: 0,
    lastCapturedAt: null,
    setup: { status, updatedAt, done: 1, total: 3, next: "keywords" },
  });

  it("answers nothing without a setup in progress", () => {
    expect(bannerApps([])).toBeNull();
    expect(
      bannerApps([
        app("done", "completed", "2026-10-14T09:00:00.000Z"),
        { ...app("old", "in_progress", null), setup: undefined },
      ]),
    ).toBeNull();
  });

  it("names the only app in setup", () => {
    expect(
      bannerApps([app("one", "in_progress", "2026-10-14T09:00:00.000Z")]),
    ).toMatchObject({ app: { id: "one" }, more: 0 });
  });

  it("names the app touched last and counts the others", () => {
    expect(
      bannerApps([
        app("never", "in_progress", null),
        app("older", "in_progress", "2026-10-13T09:00:00.000Z"),
        app("dismissed", "dismissed", "2026-10-15T09:00:00.000Z"),
        app("newest", "in_progress", "2026-10-14T09:00:00.000Z"),
      ]),
    ).toMatchObject({ app: { id: "newest" }, more: 2 });
  });

  it("puts apps never touched or with an unreadable time last", () => {
    expect(
      bannerApps([
        app("never", "in_progress", null),
        app("garbled", "in_progress", "not a date"),
        app("other", "in_progress", null),
        app("dated", "in_progress", "2026-10-13T09:00:00.000Z"),
      ]),
    ).toMatchObject({ app: { id: "dated" }, more: 3 });
  });
});

describe("keywordsStepDescription", () => {
  it("names the title and subtitle of an App Store listing", () => {
    expect(keywordsStepDescription("APP_STORE")).toBe(
      "Track at least 10 keywords in your home storefront. The import already tracked the phrases of your title and subtitle.",
    );
  });

  it("names the title and short description of a Google Play listing", () => {
    expect(keywordsStepDescription("GOOGLE_PLAY")).toBe(
      "Track at least 10 keywords in your home storefront. The import already tracked the phrases of your title and short description.",
    );
  });
});
