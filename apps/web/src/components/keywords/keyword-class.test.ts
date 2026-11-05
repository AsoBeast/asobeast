import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { optimisticKeyword } from "./keyword-class";

const row = {
  keywordId: "kw-1",
  text: "forest",
  active: true,
  note: null,
  keywordClass: "ownBrand",
  keywordClassSource: "detected",
} as TrackedKeywordItem;

describe("optimisticKeyword", () => {
  it("shows a chosen class as set by the owner at once", () => {
    expect(optimisticKeyword(row, { keywordClass: "generic" })).toEqual({
      ...row,
      keywordClass: "generic",
      keywordClassSource: "owner",
    });
  });

  it("keeps the detected class on screen until the reset is refetched", () => {
    expect(optimisticKeyword(row, { keywordClass: null })).toEqual(row);
  });

  it("merges every other field and leaves the class alone", () => {
    expect(optimisticKeyword(row, { note: "x", active: false })).toEqual({
      ...row,
      note: "x",
      active: false,
    });
  });
});
