import { describe, expect, it } from "vitest";
import { keywordSteps, NO_STEPS } from "./keyword-steps";

describe("keywordSteps", () => {
  const shown = ["kw-1", "kw-2", "kw-3"];

  it("names the rows around a keyword in the order the table shows", () => {
    expect(keywordSteps(shown, "kw-2")).toEqual({
      previous: "kw-1",
      next: "kw-3",
    });
  });

  it("has nothing before the first row or after the last", () => {
    expect(keywordSteps(shown, "kw-1")).toEqual({
      previous: null,
      next: "kw-2",
    });
    expect(keywordSteps(shown, "kw-3")).toEqual({
      previous: "kw-2",
      next: null,
    });
  });

  it("offers no step from a keyword the filters hide", () => {
    expect(keywordSteps(shown, "kw-9")).toBe(NO_STEPS);
    expect(keywordSteps([], "kw-1")).toBe(NO_STEPS);
  });
});
