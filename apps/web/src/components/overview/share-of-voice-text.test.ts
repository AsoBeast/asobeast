import { describe, expect, it } from "vitest";
import {
  competitorsCaption,
  formatShare,
  shareLine,
  shareReason,
} from "./share-of-voice-text";

describe("shareLine", () => {
  it("writes a share with one decimal", () => {
    expect(shareLine({ current: 42, delta7d: 3.5, competitors: 1 })).toBe(
      "42.0%",
    );
    expect(formatShare(49.25)).toBe("49.3%");
  });

  it.each([
    ["noCompetitors", "Add a competitor to see your share of voice"],
    ["notChecked", "Your competitors have not been checked yet"],
    ["nobodyRanks", "Nobody ranks for these keywords yet"],
  ] as const)("says why there is no share for %s", (reason, text) => {
    expect(
      shareLine({ current: null, delta7d: null, competitors: 0, reason }),
    ).toBe(text);
    expect(shareReason(reason)).toBe(text);
  });
});

describe("competitorsCaption", () => {
  it("counts the competitors measured", () => {
    expect(competitorsCaption(1)).toBe("vs 1 competitor");
    expect(competitorsCaption(2)).toBe("vs 2 competitors");
  });
});
