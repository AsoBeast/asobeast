import { describe, expect, it } from "vitest";
import { matchesSearch, searchText } from "./search-text";

describe("searchText", () => {
  it("folds case and accents", () => {
    expect(searchText("Crème Brûlée")).toBe(searchText("creme brulee"));
  });
});

describe("matchesSearch", () => {
  it("matches any part without accents or case", () => {
    expect(matchesSearch(["Focus Timer", "Österreich"], "osterr")).toBe(true);
    expect(matchesSearch(["Focus Timer"], "calm")).toBe(false);
  });

  it("matches everything for an empty or blank query", () => {
    expect(matchesSearch(["Focus Timer"], "")).toBe(true);
    expect(matchesSearch(["Focus Timer"], "   ")).toBe(true);
  });
});
