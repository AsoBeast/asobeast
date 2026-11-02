import { describe, expect, it } from "vitest";
import {
  exactSearchEmptyBody,
  keywordColumnFilters,
  keywordFilterChips,
  keywordSearchFilter,
  type KeywordFilters,
  tagOptions,
} from "./keyword-filters";

const NONE: KeywordFilters = {
  q: "",
  source: [],
  bucket: [],
  status: "all",
  pop: [],
  diff: [],
  opp: [],
  pos: [],
  tag: [],
};

describe("keywordColumnFilters", () => {
  it("applies nothing when every filter is at its default", () => {
    expect(keywordColumnFilters(NONE)).toEqual([]);
  });

  it("maps each active filter to its column", () => {
    expect(
      keywordColumnFilters({
        ...NONE,
        source: ["MANUAL"],
        bucket: ["primary"],
        status: "paused",
        pop: ["strong"],
        diff: ["fair"],
        opp: ["weak"],
        pos: ["unranked"],
      }),
    ).toEqual([
      { id: "source", value: ["MANUAL"] },
      { id: "bucket", value: ["primary"] },
      { id: "status", value: "paused" },
      { id: "traffic", value: ["strong"] },
      { id: "difficulty", value: ["fair"] },
      { id: "opportunity", value: ["weak"] },
      { id: "position", value: ["unranked"] },
    ]);
  });
});

describe("keywordFilterChips", () => {
  it("shows no chip when nothing is filtered", () => {
    expect(keywordFilterChips(NONE)).toEqual([]);
  });

  it("names every active filter with its labels", () => {
    expect(
      keywordFilterChips({
        q: "pomo",
        source: ["MANUAL", "TITLE"],
        bucket: ["longtail"],
        status: "active",
        pop: ["strong", "fair"],
        diff: ["poor"],
        opp: ["weak"],
        pos: ["top3", "unranked"],
        tag: [],
      }),
    ).toEqual([
      { key: "q", label: "Search: pomo" },
      { key: "source", label: "Source: Manual, Title" },
      { key: "bucket", label: "Bucket: Long tail" },
      { key: "status", label: "Status: Active" },
      { key: "pop", label: "Popularity: strong, fair" },
      { key: "diff", label: "Difficulty: poor" },
      { key: "opp", label: "Opportunity: weak" },
      { key: "pos", label: "Position: Top 3, Not ranking" },
    ]);
  });
});

describe("tag filters", () => {
  it("filters the tags column and names the tags in a chip", () => {
    const filters = { ...NONE, tag: ["brand", "core"] };

    expect(keywordColumnFilters(filters)).toEqual([
      { id: "tags", value: ["brand", "core"] },
    ]);
    expect(keywordFilterChips(filters)).toEqual([
      { key: "tag", label: "Tag: brand, core" },
    ]);
  });

  it("offers the tags present and any selected tag no row carries, sorted", () => {
    expect(tagOptions(["testing", "core"], ["archived"])).toEqual([
      { value: "archived", label: "archived" },
      { value: "core", label: "core" },
      { value: "testing", label: "testing" },
    ]);
    expect(tagOptions([], [])).toEqual([]);
  });
});

describe("the quoted search", () => {
  it("names an exact phrase in its chip", () => {
    expect(keywordFilterChips({ ...NONE, q: '"focus timer"' })).toEqual([
      { key: "q", label: "Exact phrase: focus timer" },
    ]);
  });

  it("names an unbalanced quote as a plain search", () => {
    expect(keywordFilterChips({ ...NONE, q: '"focus' })).toEqual([
      { key: "q", label: 'Search: "focus' },
    ]);
  });

  it("explains an empty table only for an exact phrase", () => {
    expect(exactSearchEmptyBody('"focus timer"')).toBe(
      'No keyword is exactly "focus timer" with these filters. Remove the quotes to match keywords that contain it.',
    );
    expect(exactSearchEmptyBody("focus")).toBeUndefined();
  });

  it("filters a row by the whole keyword", () => {
    const rowOf = (text: string) =>
      ({ getValue: () => text }) as unknown as Parameters<
        typeof keywordSearchFilter
      >[0];
    const filter = (text: string, q: string) =>
      keywordSearchFilter(rowOf(text), "keyword", q, () => undefined);

    expect(filter("focus timer", '"focus timer"')).toBe(true);
    expect(filter("focus timer app", '"focus timer"')).toBe(false);
  });
});
