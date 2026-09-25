import { describe, expect, it } from "vitest";
import { tagsLabel, visibleTags } from "./keyword-tags";

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
