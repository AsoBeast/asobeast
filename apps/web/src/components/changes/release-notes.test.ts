import { describe, expect, it } from "vitest";
import { releaseNotesInline } from "./release-notes";

describe("releaseNotesInline", () => {
  it("joins Google Play note lines without their markup", () => {
    expect(
      releaseNotesInline("v4.6863<br>New memes:<br>✓ Blank Stare<br>"),
    ).toBe("v4.6863 · New memes: · ✓ Blank Stare");
  });

  it("drops leading list markers", () => {
    expect(
      releaseNotesInline(
        "v2<br>- Stickers<br>• Exports<br>* Sync<br>– Themes<br>·Fonts",
      ),
    ).toBe("v2 · Stickers · Exports · Sync · Themes · Fonts");
  });

  it("keeps a leading dash that is part of the text", () => {
    expect(releaseNotesInline("-20% battery use<br>*New* widgets")).toBe(
      "-20% battery use · *New* widgets",
    );
  });

  it("drops lines that hold only a marker", () => {
    expect(releaseNotesInline("Fixes<br>-<br>•")).toBe("Fixes");
  });

  it("joins plain multi-line notes", () => {
    expect(releaseNotesInline("Bug fixes\n- Faster sync")).toBe(
      "Bug fixes · Faster sync",
    );
  });

  it("returns an empty string for markup alone", () => {
    expect(releaseNotesInline("<br><br/>")).toBe("");
  });
});
