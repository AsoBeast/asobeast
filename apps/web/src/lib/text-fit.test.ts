import { describe, expect, it } from "vitest";
import { clipText, wrapWords, type Measure } from "./text-fit";

const tenPerCharacter: Measure = (text) => Array.from(text).length * 10;

describe("clipText", () => {
  it("keeps a text that fits", () => {
    expect(clipText("focus", 50, tenPerCharacter)).toBe("focus");
  });

  it("cuts to the room and ends with an ellipsis", () => {
    expect(clipText("focus timer", 60, tenPerCharacter)).toBe("focus…");
  });

  it("never splits a surrogate pair", () => {
    expect(clipText("𠮷𠮷𠮷𠮷", 30, tenPerCharacter)).toBe("𠮷𠮷…");
  });

  it("returns only the ellipsis when nothing fits", () => {
    expect(clipText("focus", 5, tenPerCharacter)).toBe("…");
  });
});

describe("wrapWords", () => {
  it("wraps at the last word that fits", () => {
    expect(wrapWords("aa bb cc dd", 50, tenPerCharacter)).toEqual([
      "aa bb",
      "cc dd",
    ]);
  });

  it("keeps a single long word on its own line", () => {
    expect(wrapWords("abcdefghij kl", 50, tenPerCharacter)).toEqual([
      "abcdefghij",
      "kl",
    ]);
  });

  it("returns no lines for an empty text", () => {
    expect(wrapWords("", 50, tenPerCharacter)).toEqual([]);
  });
});
