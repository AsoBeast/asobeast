import { describe, expect, it } from "vitest";
import { selectTopLabel, ideaSuggestions, topIdeas } from "./ideas-selection";

const spider = (text: string, priority: number | null = null) => ({
  text,
  priority,
  probes: 1,
});

describe("ideaSuggestions", () => {
  it("maps each spider row to a search suggestion and keeps a priority", () => {
    expect(ideaSuggestions([spider("a", 3), spider("b")])).toEqual([
      { text: "a", strategy: "search", priority: 3 },
      { text: "b", strategy: "search" },
    ]);
  });
});

describe("topIdeas", () => {
  const rows = ideaSuggestions(
    ["a", "b", "c", "d", "e", "f", "g"].map((text) => spider(text)),
  );

  it("takes the first five untracked rows in order", () => {
    expect(topIdeas(rows, new Set(["b"]))).toEqual(["a", "c", "d", "e", "f"]);
  });

  it("takes fewer when fewer are left", () => {
    expect(topIdeas(rows.slice(0, 2), new Set(["a"]))).toEqual(["b"]);
  });

  it("honours a count", () => {
    expect(topIdeas(rows, new Set(), 2)).toEqual(["a", "b"]);
  });
});

describe("selectTopLabel", () => {
  it("names the count", () => {
    expect(selectTopLabel(3)).toBe("Select top 3");
  });
});
