import { describe, expect, it } from "vitest";
import { healthFill } from "./meter";

describe("healthFill", () => {
  it.each([
    [0, "bg-destructive"],
    [0.2, "bg-destructive"],
    [0.4, "bg-warning"],
    [0.5, "bg-warning"],
    [0.7, "bg-success"],
    [1, "bg-success"],
  ])("paints %s as %s", (ratio, expected) => {
    expect(healthFill(ratio)).toBe(expected);
  });

  it("separates a weak, a middling and a strong score", () => {
    expect(
      new Set([healthFill(0.2), healthFill(0.5), healthFill(0.9)]).size,
    ).toBe(3);
  });
});
