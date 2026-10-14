import { describe, expect, it } from "vitest";
import {
  activeKeywordCount,
  loadingSentence,
  nextLabel,
  progressPercent,
  progressSentence,
  setupSentence,
  stepLabel,
} from "./setup-progress";

describe("progressSentence", () => {
  it("names the app, the count and the next step", () => {
    expect(
      progressSentence("Focus Timer", { done: 1, total: 3, next: "keywords" }),
    ).toBe("Set up Focus Timer · 1 of 3 · next: track keywords");
  });

  it("says the setup is ready once no step is next", () => {
    expect(
      progressSentence("Focus Timer", { done: 3, total: 3, next: null }),
    ).toBe("Set up Focus Timer · 3 of 3 · ready to complete");
  });

  it("speaks of this app when the name is unknown", () => {
    expect(
      progressSentence(null, { done: 0, total: 3, next: "competitors" }),
    ).toBe("Set up this app · 0 of 3 · next: pick competitors");
    expect(loadingSentence(null)).toBe("Set up this app · loading progress");
    expect(setupSentence("Focus Timer")).toBe("Set up Focus Timer");
  });
});

describe("nextLabel", () => {
  it("lowercases the step title", () => {
    expect(nextLabel("countries")).toBe("add countries");
  });
});

describe("progressPercent", () => {
  it("measures the settled share of the steps", () => {
    expect(progressPercent({ done: 0, total: 3, next: "competitors" })).toBe(0);
    expect(progressPercent({ done: 3, total: 3, next: null })).toBe(100);
  });
});

describe("stepLabel", () => {
  it("numbers a step among three", () => {
    expect(stepLabel("competitors")).toBe("Step 1 of 3");
    expect(stepLabel("keywords")).toBe("Step 2 of 3");
    expect(stepLabel("countries")).toBe("Step 3 of 3");
  });
});

describe("activeKeywordCount", () => {
  it("counts only active keywords", () => {
    expect(
      activeKeywordCount([
        { active: true },
        { active: false },
        { active: true },
      ]),
    ).toBe(2);
  });
});
