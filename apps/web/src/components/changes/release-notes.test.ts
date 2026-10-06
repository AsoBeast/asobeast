import { describe, expect, it } from "vitest";
import { releaseNotesInline } from "./release-notes";

describe("releaseNotesInline", () => {
  it("joins note lines", () => {
    expect(releaseNotesInline("v4.6863\nNew memes:\n✓ Blank Stare")).toBe(
      "v4.6863 · New memes: · ✓ Blank Stare",
    );
  });

  it("drops leading list markers", () => {
    expect(
      releaseNotesInline("v2\n- Stickers\n• Exports\n* Sync\n– Themes\n·Fonts"),
    ).toBe("v2 · Stickers · Exports · Sync · Themes · Fonts");
  });

  it("keeps a leading dash that is part of the text", () => {
    expect(releaseNotesInline("-20% battery use\n*New* widgets")).toBe(
      "-20% battery use · *New* widgets",
    );
  });

  it("drops lines that hold only a marker", () => {
    expect(releaseNotesInline("Fixes\n-\n•")).toBe("Fixes");
  });

  it("keeps text that looks like markup exactly as written", () => {
    expect(
      releaseNotesInline("Type <Username> to mention\nFixes &amp; <br> more"),
    ).toBe("Type <Username> to mention · Fixes &amp; <br> more");
  });

  it("trims lines and drops blank ones however the store broke them", () => {
    expect(
      releaseNotesInline("  New: \r\n\r\n   \n  - Faster sync  \rDone"),
    ).toBe("New: · Faster sync · Done");
  });

  it("returns an empty string for empty notes", () => {
    expect(releaseNotesInline("")).toBe("");
  });
});
