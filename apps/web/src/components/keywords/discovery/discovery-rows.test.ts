import type {
  KeywordDiscoveryItem,
  KeywordDiscoveryList,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  difficultyScore,
  emptyStateOf,
  opportunityScore,
  popularityScore,
  rankLabel,
  rankText,
  relevanceScore,
} from "./discovery-rows";

const item = (
  overrides: Partial<KeywordDiscoveryItem> = {},
): KeywordDiscoveryItem => ({
  keywordId: "kw",
  text: "focus timer app",
  country: "us",
  source: "title",
  position: 3,
  depth: 200,
  checkedOn: "2026-11-03",
  traffic: 5.2,
  difficulty: 4.1,
  volume: 52,
  relevance: 85,
  opportunity: 41,
  state: "ranked",
  recommended: true,
  ...overrides,
});

const list = (
  items: KeywordDiscoveryItem[],
  checkedAt: string | null = "2026-11-03T08:00:00.000Z",
): KeywordDiscoveryList => ({
  items,
  counts: { all: items.length, ranked: 0, opportunity: 0 },
  autoTrackRanked: false,
  unfit: 0,
  checks: {
    perWeek: 40,
    usedThisWeek: 0,
    pending: 0,
    checkedAt,
    nextRunAt: null,
  },
});

describe("rankText", () => {
  it("names the rank, the depth searched or nothing, never zero", () => {
    expect(rankText({ position: 3, depth: 200 })).toBe("3");
    expect(rankText({ position: null, depth: 200 })).toBe(">200");
    expect(rankText({ position: null, depth: 50 })).toBe(">50");
    expect(rankText({ position: null, depth: null })).toBeNull();
  });
});

describe("rankLabel", () => {
  it("speaks each rank state", () => {
    expect(rankLabel({ position: 3, depth: 200 })).toBe("Rank 3");
    expect(rankLabel({ position: null, depth: 200 })).toBe(
      "Not found in the top 200",
    );
    expect(rankLabel({ position: null, depth: 50 })).toBe(
      "Not found in the top 50",
    );
    expect(rankLabel({ position: null, depth: null })).toBe("Not checked yet");
  });
});

describe("scores", () => {
  it("grades each score on its own scale", () => {
    const row = item();

    expect(popularityScore(row)).toEqual({ value: 52, grade: "fair" });
    expect(difficultyScore(row)).toEqual({ value: 41, grade: "fair" });
    expect(relevanceScore(row)).toEqual({ value: 85, grade: "strong" });
    expect(opportunityScore(row)).toEqual({ value: 41, grade: "fair" });
  });

  it("leaves a missing score ungraded", () => {
    const row = item({ volume: null, difficulty: null, opportunity: null });

    expect(popularityScore(row)).toEqual({ value: null, grade: null });
    expect(difficultyScore(row)).toEqual({ value: null, grade: null });
    expect(opportunityScore(row)).toEqual({ value: null, grade: null });
  });
});

describe("emptyStateOf", () => {
  it("shows the rows when there are some", () => {
    expect(emptyStateOf(list([item()]), 1, "all")).toEqual({ kind: "none" });
  });

  it("says discovery never ran without rows or a check", () => {
    expect(emptyStateOf(list([], null), 0, "all")).toMatchObject({
      kind: "never_run",
    });
  });

  it("promises no result and no time while a check is queued", () => {
    const queued = list([], null);
    queued.checks.pending = 2;
    queued.checks.nextRunAt = "2026-11-09T07:30:00.000Z";
    expect(emptyStateOf(queued, 0, "all")).toEqual({
      kind: "never_run",
      body: "AsoBeast has queued checks of the keywords near your listing. Any it finds in this market appear here.",
    });
    const weekly = list([], null);
    weekly.checks.nextRunAt = "2026-11-09T07:30:00.000Z";
    expect(emptyStateOf(weekly, 0, "all")).toEqual({
      kind: "never_run",
      body: "AsoBeast looks for keywords near your listing once a week. Press Refresh to look now.",
    });
  });

  it("claims no schedule it cannot read", () => {
    const off = list([], null);
    off.checks.nextRunAt = null;
    expect(emptyStateOf(off, 0, "all")).toEqual({
      kind: "never_run",
      body: "AsoBeast has not looked for keywords near your listing yet. Press Refresh to look now.",
    });
  });

  it("names why a filtered view is empty", () => {
    expect(emptyStateOf(list([item()]), 0, "ranked")).toMatchObject({
      kind: "nothing_here",
      title: "Nothing ranked yet",
    });
    expect(emptyStateOf(list([item()]), 0, "opportunity")).toMatchObject({
      kind: "nothing_here",
      body: "Opportunities need a popularity and a difficulty score. Track a keyword to score it, or wait for the next scoring run.",
    });
    expect(emptyStateOf(list([]), 0, "all")).toMatchObject({
      kind: "nothing_here",
      title: "Nothing to review",
    });
  });
});
