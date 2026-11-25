import { describe, expect, it, vi } from "vitest";
import { createCanvasMeasure } from "./canvas-measure";

function stubContext() {
  const fonts: string[] = [];
  const measureText = vi.fn((text: string) => ({
    width: Array.from(text).length * (fonts.at(-1)?.startsWith("700") ? 2 : 1),
  }));
  const context = {
    set font(font: string) {
      fonts.push(font);
    },
    measureText,
  };
  return {
    fonts,
    measureText,
    read: () => context as unknown as CanvasRenderingContext2D,
  };
}

describe("createCanvasMeasure", () => {
  it("sets the font before each measure", () => {
    const stub = stubContext();
    const measure = createCanvasMeasure(stub.read);
    expect(measure?.("400 13px Arial")("abc")).toBe(3);
    expect(measure?.("700 17px Arial")("abc")).toBe(6);
    expect(stub.fonts).toEqual(["400 13px Arial", "700 17px Arial"]);
  });

  it("caches a width per font and text", () => {
    const stub = stubContext();
    const measure = createCanvasMeasure(stub.read);
    measure?.("400 13px Arial")("abc");
    measure?.("400 13px Arial")("abc");
    measure?.("700 17px Arial")("abc");
    expect(stub.measureText).toHaveBeenCalledTimes(2);
  });

  it("forgets only the oldest width once the cache is full", () => {
    const stub = stubContext();
    const measure = createCanvasMeasure(stub.read)?.("400 13px Arial");
    for (let index = 0; index <= 500; index += 1) measure?.(`word ${index}`);
    measure?.("word 500");
    measure?.("word 1");
    expect(stub.measureText).toHaveBeenCalledTimes(501);
    measure?.("word 0");
    expect(stub.measureText).toHaveBeenCalledTimes(502);
  });

  it("answers null without a 2D context", () => {
    expect(createCanvasMeasure(() => null)).toBeNull();
  });
});
