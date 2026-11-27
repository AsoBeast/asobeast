import { describe, expect, it } from "vitest";
import { fitCardText, textDirection } from "./card-text";

const measureAt = (size: number) => (text: string) =>
  Array.from(text).length * size;

describe("fitCardText", () => {
  it("keeps text that fits at its size", () => {
    expect(fitCardText("Focus", 100, 10, measureAt)).toEqual({
      text: "Focus",
      size: 10,
    });
  });

  it("steps the size down before cutting", () => {
    const fitted = fitCardText("Focus timer", 90, 10, measureAt);

    expect(fitted.text).toBe("Focus timer");
    expect(fitted.size).toBeLessThan(10);
    expect(fitted.size * 11).toBeLessThanOrEqual(90);
  });

  it("ends with an ellipsis when even the smallest size is too wide", () => {
    const fitted = fitCardText("a".repeat(60), 100, 10, measureAt);

    expect(fitted.text.endsWith("…")).toBe(true);
    expect(fitted.size).toBeGreaterThanOrEqual(7);
    expect(measureAt(fitted.size)(fitted.text)).toBeLessThanOrEqual(100);
  });
});

describe("textDirection", () => {
  it.each([
    ["Focus Timer", "ltr"],
    ["تطبيق التركيز", "rtl"],
    ["שעון", "rtl"],
    ["123 تطبيق", "rtl"],
    ["123", "ltr"],
    ["", "ltr"],
  ])("reads %j as %s", (text, direction) => {
    expect(textDirection(text)).toBe(direction);
  });
});
