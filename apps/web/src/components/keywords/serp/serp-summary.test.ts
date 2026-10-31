import { describe, expect, it } from "vitest";
import type {
  SerpEntryItem,
  SerpSnapshot,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { serpSummary } from "./serp-summary";

const VIEWER = { appId: "app-1", storeAppId: "123456789" };
const NEWEST = "2026-10-31";
const OLDER = "2026-10-30";

function entry(
  position: number,
  over: Partial<SerpEntryItem> = {},
): SerpEntryItem {
  return {
    position,
    storeAppId: `store-${position}`,
    title: `App ${position}`,
    developer: null,
    ratingAvg: null,
    ratingCount: null,
    appId: null,
    isCompetitor: false,
    ...over,
  };
}

function snapshot(
  entries: SerpEntryItem[],
  date: string = NEWEST,
): SerpSnapshot {
  return {
    keywordId: "kw-1",
    text: "focus timer",
    date,
    entries,
    dates: [NEWEST, OLDER],
  };
}

const keyword = (
  over: Pick<TrackedKeywordItem, "latestPosition" | "latestDepth">,
) => over as TrackedKeywordItem;

const listOf = (count: number) =>
  Array.from({ length: count }, (_, index) => entry(index + 1));

describe("serpSummary position", () => {
  it("points at your row with its movement", () => {
    const entries = listOf(5);
    entries[2] = entry(3, {
      appId: "app-1",
      previous: 5,
      delta: -2,
      movement: "up",
    });

    expect(serpSummary(snapshot(entries), VIEWER).position).toEqual({
      kind: "listed",
      position: 3,
      moved: { movement: "up", delta: -2, previous: 5 },
    });
  });

  it("recognises your row by its store id", () => {
    const entries = [entry(1, { storeAppId: VIEWER.storeAppId })];

    expect(serpSummary(snapshot(entries), VIEWER).position).toMatchObject({
      kind: "listed",
      position: 1,
      moved: { movement: "none", delta: null, previous: null },
    });
  });

  it("names a checked position deeper than the list on the newest day", () => {
    expect(
      serpSummary(
        snapshot(listOf(50)),
        VIEWER,
        keyword({ latestPosition: 73, latestDepth: 200 }),
      ).position,
    ).toEqual({ kind: "deeper", position: 73, listed: 50 });
  });

  it("says the check found you nowhere within its depth", () => {
    expect(
      serpSummary(
        snapshot(listOf(50)),
        VIEWER,
        keyword({ latestPosition: null, latestDepth: 200 }),
      ).position,
    ).toEqual({ kind: "notFound", depth: 200 });
  });

  it("claims no position on an older day or without the keyword row", () => {
    const deeper = keyword({ latestPosition: 73, latestDepth: 200 });

    expect(
      serpSummary(snapshot(listOf(10), OLDER), VIEWER, deeper).position,
    ).toEqual({ kind: "absent" });
    expect(serpSummary(snapshot(listOf(10)), VIEWER).position).toEqual({
      kind: "absent",
    });
    expect(
      serpSummary(
        snapshot(listOf(10)),
        VIEWER,
        keyword({ latestPosition: null, latestDepth: null }),
      ).position,
    ).toEqual({ kind: "absent" });
  });
});

describe("serpSummary titles", () => {
  it("counts the top 10 titles that hold the whole keyword", () => {
    const entries = listOf(12).map((row) => ({
      ...row,
      titleMatch:
        row.position <= 7 || row.position > 10
          ? ("phrase" as const)
          : ("words" as const),
    }));

    expect(serpSummary(snapshot(entries), VIEWER).titles).toEqual({
      withKeyword: 7,
      of: 10,
    });
  });

  it("counts over the entries a short list holds", () => {
    const entries = listOf(6).map((row) => ({
      ...row,
      titleMatch: "partial" as const,
    }));

    expect(serpSummary(snapshot(entries), VIEWER).titles).toEqual({
      withKeyword: 0,
      of: 6,
    });
  });

  it("reports nothing when no title was judged", () => {
    expect(serpSummary(snapshot(listOf(10)), VIEWER).titles).toBeNull();
  });
});

describe("serpSummary ratings", () => {
  it("answers the lower middle rating count of the top 10 that report one", () => {
    const counts = [100, 24000, 900, null, 300];
    const entries = counts.map((ratingCount, index) =>
      entry(index + 1, { ratingCount }),
    );

    expect(serpSummary(snapshot(entries), VIEWER).ratings).toEqual({
      kind: "median",
      value: 300,
    });
    expect(serpSummary(snapshot(entries.slice(0, 3)), VIEWER).ratings).toEqual({
      kind: "median",
      value: 900,
    });
  });

  it("leaves rows below the top 10 out of the median", () => {
    const entries = [
      entry(1, { ratingCount: 10 }),
      entry(11, { ratingCount: 99999 }),
      entry(12, { ratingCount: 99999 }),
    ];

    expect(serpSummary(snapshot(entries), VIEWER).ratings).toEqual({
      kind: "median",
      value: 10,
    });
  });

  it("averages the ratings when no count is reported", () => {
    const entries = [
      entry(1, { ratingAvg: 4.5 }),
      entry(2, { ratingAvg: 4.6 }),
      entry(3),
    ];

    const ratings = serpSummary(snapshot(entries), VIEWER).ratings;
    expect(ratings.kind).toBe("average");
    expect(ratings.kind === "average" && ratings.value).toBeCloseTo(4.55);
  });

  it("answers none without a count or a rating", () => {
    expect(serpSummary(snapshot(listOf(3)), VIEWER).ratings).toEqual({
      kind: "none",
    });
  });
});
