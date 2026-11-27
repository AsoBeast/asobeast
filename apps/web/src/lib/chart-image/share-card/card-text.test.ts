import { describe, expect, it } from "vitest";
import { fitCardText, fitLead, textDirection } from "./card-text";

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

describe("fitLead", () => {
  const measureAt = (size: number) => (text: string) =>
    Array.from(text.replace(/[\u2068\u2069]/g, "")).length * size;

  it("keeps the keyword whole when the line fits", () => {
    expect(
      fitLead({ prefix: "Rank for ", term: "focus" }, 200, 10, measureAt),
    ).toEqual({ text: "“\u2068focus\u2069”", size: 10 });
  });

  it("shrinks the prefix and the keyword together", () => {
    const { size } = fitLead(
      { prefix: "Rank for ", term: "focus timer" },
      190,
      10,
      measureAt,
    );

    expect(size).toBeLessThan(10);
    expect(size).toBeGreaterThanOrEqual(7);
  });

  it("cuts a long keyword inside its quotes", () => {
    const { text, size } = fitLead(
      { prefix: "Rank for ", term: "best pomodoro focus timer for study" },
      200,
      10,
      measureAt,
    );

    expect(size).toBeCloseTo(7.29);
    expect(text.startsWith("“\u2068best")).toBe(true);
    expect(text.endsWith("…\u2069”")).toBe(true);
    expect(measureAt(size)(`Rank for ${text}`)).toBeLessThanOrEqual(200);
  });

  it("isolates a right to left keyword so its quotes keep their sides", () => {
    expect(
      fitLead({ prefix: "Rank for ", term: "مؤقت" }, 500, 10, measureAt).text,
    ).toBe("“\u2068مؤقت\u2069”");
  });
});
