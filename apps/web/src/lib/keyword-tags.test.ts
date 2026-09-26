import { describe, expect, it } from "vitest";
import {
  addTag,
  bulkTagChanges,
  splitTagInput,
  tagsIn,
  tagSuggestions,
  tagsLabel,
  visibleTags,
} from "./keyword-tags";

describe("visibleTags", () => {
  it("shows the first three and counts the rest", () => {
    expect(visibleTags(["a", "b", "c", "d", "e"], 3)).toEqual({
      shown: ["a", "b", "c"],
      hidden: 2,
    });
  });

  it("hides nothing when every tag fits", () => {
    expect(visibleTags(["a"])).toEqual({ shown: ["a"], hidden: 0 });
  });
});

describe("tagsLabel", () => {
  it("names every tag", () => {
    expect(tagsLabel(["core", "exam season"])).toBe("Tags: core, exam season");
  });
});

describe("addTag", () => {
  it("adds a normalized tag", () => {
    expect(addTag(["core"], " Exam  Season ")).toEqual({
      tags: ["core", "exam season"],
      refused: null,
    });
  });

  it.each([
    [["core"], "#hash", "invalid"],
    [["core"], "Core", "duplicate"],
    [["a", "b", "c", "d", "e", "f", "g", "h"], "i", "limit"],
  ] as const)("refuses %j plus %j as %s", (tags, raw, refused) => {
    expect(addTag(tags, raw)).toEqual({ tags: [...tags], refused });
  });
});

describe("splitTagInput", () => {
  it("completes every tag before a comma and keeps the rest", () => {
    expect(splitTagInput("core, brand,")).toEqual({
      complete: ["core", "brand"],
      rest: "",
    });
    expect(splitTagInput("core, bra")).toEqual({
      complete: ["core"],
      rest: " bra",
    });
  });
});

describe("tagSuggestions", () => {
  it("offers the suggestions then the market tags, minus the present ones", () => {
    expect(tagSuggestions(["core"], ["exam season", "brand"])).toEqual([
      "brand",
      "testing",
      "exam season",
    ]);
  });

  it("offers nothing at the limit", () => {
    expect(
      tagSuggestions(["a", "b", "c", "d", "e", "f", "g", "h"], ["brand"]),
    ).toEqual([]);
  });
});

describe("tagsIn", () => {
  it("lists every tag of the rows once, sorted", () => {
    expect(
      tagsIn([{ tags: ["core", "brand"] }, { tags: ["core"] }, {}]),
    ).toEqual(["brand", "core"]);
  });
});

describe("bulkTagChanges", () => {
  const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rows = [
    { keywordId: "k1", text: "focus timer", tags: ["core"] },
    { keywordId: "k2", text: "pomodoro", tags: [] },
    { keywordId: "k3", text: "study timer", tags: eight },
    { keywordId: "k4", text: "time blocking" },
  ];

  it("adds the tag only where it is missing and names keywords at the limit", () => {
    expect(bulkTagChanges(rows, "core", "add")).toEqual({
      changes: [
        { keywordId: "k2", tags: ["core"] },
        { keywordId: "k4", tags: ["core"] },
      ],
      atLimit: ["study timer"],
    });
  });

  it("removes the tag only where it is present", () => {
    expect(bulkTagChanges(rows, "core", "remove")).toEqual({
      changes: [{ keywordId: "k1", tags: [] }],
      atLimit: [],
    });
  });
});
