import { describe, expect, it } from "vitest";
import {
  keywordColumnFilters,
  keywordFilterChips,
  type KeywordFilters,
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
