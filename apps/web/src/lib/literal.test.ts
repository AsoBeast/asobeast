import { describe, expect, it } from "vitest";
import { REVIEW_SORTS } from "@asobeast/shared";
import { literalOf } from "./literal";

describe("literalOf", () => {
  it("answers the member a value names", () => {
    expect(literalOf(REVIEW_SORTS, "lowest")).toBe("lowest");
  });

  it("answers nothing for a value outside the list", () => {
    expect(literalOf(REVIEW_SORTS, "oldest")).toBeUndefined();
  });
});
