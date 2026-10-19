import { describe, expect, it } from "vitest";
import { OVERFLOW_TOLERANCE_PX, overflows } from "./scroll-overflow";

const box = (
  scrollWidth: number,
  clientWidth: number,
  scrollHeight = 100,
  clientHeight = 100,
) => ({ scrollWidth, clientWidth, scrollHeight, clientHeight });

describe("overflows", () => {
  it("is false when the content fits", () => {
    expect(overflows(box(300, 300))).toBe(false);
  });

  it("is true when the content is wider than the box", () => {
    expect(overflows(box(420, 311))).toBe(true);
  });

  it("is true when the content is taller than the box", () => {
    expect(overflows(box(300, 300, 400, 288))).toBe(true);
  });

  it("ignores a rounding difference up to the tolerance", () => {
    expect(overflows(box(300 + OVERFLOW_TOLERANCE_PX, 300))).toBe(false);
    expect(overflows(box(300 + OVERFLOW_TOLERANCE_PX + 1, 300))).toBe(true);
    expect(overflows(box(300, 300, 100 + OVERFLOW_TOLERANCE_PX, 100))).toBe(
      false,
    );
  });
});
