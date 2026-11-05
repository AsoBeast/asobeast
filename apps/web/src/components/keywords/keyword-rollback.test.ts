import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { rollbackKeywordUpdate } from "./keyword-rollback";

function keyword(
  keywordId: string,
  fields: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem {
  return {
    keywordId,
    text: keywordId,
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: null,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
    serpVolatility7d: null,
    tags: [],
    note: null,
    ...fields,
  };
}

describe("rollbackKeywordUpdate", () => {
  it("reverts the failed field and keeps a concurrent note and tags edit", () => {
    const previous = [keyword("kw-1")];
    const current = [
      keyword("kw-1", { active: false, tags: ["core"], note: "Push in May" }),
    ];

    expect(
      rollbackKeywordUpdate(current, previous, "kw-1", { active: false }),
    ).toEqual([
      keyword("kw-1", { active: true, tags: ["core"], note: "Push in May" }),
    ]);
  });

  it("leaves every other row as currently cached", () => {
    const previous = [keyword("kw-1"), keyword("kw-2")];
    const current = [
      keyword("kw-1", { note: "Failed" }),
      keyword("kw-2", { active: false }),
    ];

    expect(
      rollbackKeywordUpdate(current, previous, "kw-1", { note: "Failed" }),
    ).toEqual([keyword("kw-1"), keyword("kw-2", { active: false })]);
  });

  it("restores a field the previous row did not carry", () => {
    const untagged = keyword("kw-1", { tags: undefined });
    const current = [keyword("kw-1", { tags: ["core"] })];

    expect(
      rollbackKeywordUpdate(current, [untagged], "kw-1", {
        tags: ["core"],
      })?.[0]?.tags,
    ).toBeUndefined();
  });

  it("keeps the row when the snapshot never held it", () => {
    const current = [keyword("kw-1", { active: false })];

    expect(
      rollbackKeywordUpdate(current, [], "kw-1", { active: false }),
    ).toEqual(current);
  });

  it("returns nothing when nothing is cached", () => {
    expect(
      rollbackKeywordUpdate(undefined, [keyword("kw-1")], "kw-1", {
        active: false,
      }),
    ).toBeUndefined();
  });

  it("restores the class and its source and keeps a concurrent tags and note edit", () => {
    const previous = [
      keyword("kw-1", {
        keywordClass: "ownBrand",
        keywordClassSource: "detected",
      }),
    ];
    const current = [
      keyword("kw-1", {
        keywordClass: "generic",
        keywordClassSource: "owner",
        tags: ["core"],
        note: "Push in May",
      }),
    ];

    expect(
      rollbackKeywordUpdate(current, previous, "kw-1", {
        keywordClass: "generic",
      }),
    ).toEqual([
      keyword("kw-1", {
        keywordClass: "ownBrand",
        keywordClassSource: "detected",
        tags: ["core"],
        note: "Push in May",
      }),
    ]);
  });

  it("leaves the class alone when the update did not name it", () => {
    const previous = [keyword("kw-1", { keywordClass: "ownBrand" })];
    const current = [
      keyword("kw-1", {
        keywordClass: "generic",
        keywordClassSource: "owner",
        note: "x",
      }),
    ];

    expect(
      rollbackKeywordUpdate(current, previous, "kw-1", { note: "x" }),
    ).toEqual([
      keyword("kw-1", { keywordClass: "generic", keywordClassSource: "owner" }),
    ]);
  });
});
