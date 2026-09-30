import { describe, expect, it } from "vitest";
import { limitCounterText, textLimit } from "./text-limit";

describe("textLimit", () => {
  it("counts the way the api limits a field", () => {
    expect(textLimit("😀".repeat(500), 500)).toEqual({ used: 500, over: 0 });
    expect(textLimit("❤\uFE0F".repeat(500), 500)).toEqual({
      used: 500,
      over: 0,
    });
  });

  it("reports how far over the limit a text is", () => {
    expect(textLimit("😀".repeat(503), 500)).toEqual({ used: 503, over: 3 });
  });
});

describe("limitCounterText", () => {
  it("shows the count against the limit", () => {
    expect(limitCounterText({ used: 11, over: 0 }, 500)).toBe("11 / 500");
  });

  it("says how many characters are over", () => {
    expect(limitCounterText({ used: 501, over: 1 }, 500)).toBe(
      "501 / 500 · 1 over the limit",
    );
  });
});
