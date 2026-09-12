import { describe, expect, it } from "vitest";
import { appIconInitial } from "./app-icon-initial";

describe("appIconInitial", () => {
  it("uppercases the first letter of a name", () => {
    expect(appIconInitial("habit tracker")).toBe("H");
  });

  it("falls back to a question mark without a name", () => {
    expect(appIconInitial(null)).toBe("?");
  });

  it("falls back to a question mark for an empty name", () => {
    expect(appIconInitial("")).toBe("?");
  });

  it("falls back to a question mark for a whitespace name", () => {
    expect(appIconInitial("   ")).toBe("?");
  });

  it("ignores leading whitespace", () => {
    expect(appIconInitial("  focus timer")).toBe("F");
  });

  it("keeps an astral first character whole", () => {
    expect(appIconInitial("🎯 Focus")).toBe("🎯");
  });

  it("keeps a multi code point grapheme whole", () => {
    expect(appIconInitial("🇯🇵 Sushi Timer")).toBe("🇯🇵");
    expect(appIconInitial("👩‍👩‍👧 Family Planner")).toBe("👩‍👩‍👧");
  });
});
