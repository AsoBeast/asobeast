import type {
  KeywordDiscoveryItem,
  KeywordDiscoveryList,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { firstDiscoveries } from "./first-discoveries";

const item = (
  text: string,
  position: number | null,
  depth: number | null,
): KeywordDiscoveryItem => ({
  keywordId: `kw-${text}`,
  text,
  country: "us",
  source: "title",
  position,
  depth,
  checkedOn: depth === null ? null : "2026-11-03",
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: 80,
  opportunity: null,
  state: position === null ? "open" : "ranked",
  recommended: true,
});

const list = (
  items: KeywordDiscoveryItem[],
  checkedAt: string | null = "2026-11-03T08:00:00.000Z",
): KeywordDiscoveryList => ({
  items,
  counts: {
    all: items.length,
    ranked: items.filter(({ position }) => position !== null).length,
    opportunity: 0,
  },
  autoTrackRanked: false,
  unfit: 0,
  checks: {
    perWeek: 40,
    usedThisWeek: 0,
    pending: 0,
    checkedAt,
    nextRunAt: "2026-11-09T07:30:00.000Z",
  },
});

describe("firstDiscoveries", () => {
  it("shows nothing before the read and for an empty checked list", () => {
    expect(firstDiscoveries(undefined)).toBeNull();
    expect(firstDiscoveries(list([]))).toBeNull();
  });

  it("says discovery is collecting before the first check", () => {
    expect(firstDiscoveries(list([item("timer", null, null)], null))).toEqual({
      status: "collecting",
    });
    expect(firstDiscoveries(list([], null))).toEqual({ status: "collecting" });
  });

  it("lists the unchecked rows when no check is scheduled", () => {
    const idle = list([item("timer", null, null)], null);
    idle.checks.nextRunAt = null;

    expect(firstDiscoveries(idle)).toMatchObject({
      status: "ready",
      rows: [{ text: "timer", rank: "not checked yet" }],
    });
  });

  it("shows the first five rows in list order with their rank", () => {
    const result = firstDiscoveries(
      list([
        item("focus timer app", 3, 200),
        item("study planner", null, 200),
        item("concentration", null, 50),
        item("work sprint", null, null),
        item("deep work", 120, 200),
        item("focus music", null, 200),
      ]),
    );

    expect(result).toEqual({
      status: "ready",
      headline:
        "Found 6 keywords near your listing. Your app already ranks for 2 of them.",
      rows: [
        {
          keywordId: "kw-focus timer app",
          text: "focus timer app",
          rank: "#3",
        },
        { keywordId: "kw-study planner", text: "study planner", rank: ">200" },
        { keywordId: "kw-concentration", text: "concentration", rank: ">50" },
        {
          keywordId: "kw-work sprint",
          text: "work sprint",
          rank: "not checked yet",
        },
        { keywordId: "kw-deep work", text: "deep work", rank: "#120" },
      ],
    });
  });

  it("invites tracking when nothing ranks yet", () => {
    expect(firstDiscoveries(list([item("timer", null, 200)]))).toMatchObject({
      headline:
        "Found 1 keyword near your listing. None of them rank yet. Track the ones that fit your app.",
    });
  });

  it("keeps a ranked list that has not been checked this week", () => {
    expect(firstDiscoveries(list([item("timer", 4, 200)], null))).toMatchObject(
      { status: "ready" },
    );
  });
});
