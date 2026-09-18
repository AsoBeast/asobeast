import { describe, expect, it } from "vitest";
import { ringGeometry, ringStroke } from "./score-ring";

describe("ringGeometry", () => {
  it.each([
    [0, 1],
    [50, 0.5],
    [100, 0],
    [null, 1],
  ])(
    "leaves %s of the ring's dash hidden as a share of %s",
    (value, hidden) => {
      const { circumference, offset } = ringGeometry(value, 100, 132, 10);

      expect(offset / circumference).toBeCloseTo(hidden, 5);
    },
  );

  it("clamps a value above the maximum", () => {
    expect(ringGeometry(140, 100, 132, 10).offset).toBe(0);
  });
});

describe("ringStroke", () => {
  it.each([
    [0.39, "stroke-destructive"],
    [0.4, "stroke-warning"],
    [0.69, "stroke-warning"],
    [0.7, "stroke-success"],
  ])("paints a ratio of %s with %s", (ratio, token) => {
    expect(ringStroke(ratio)).toBe(token);
  });
});
