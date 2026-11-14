import { describe, expect, it } from "vitest";
import type { AuditScreenshotObservation } from "@asobeast/shared";
import { screenshotSummary } from "./creative-summary";

const shot = (
  position: number,
  extra: Partial<AuditScreenshotObservation> = {},
): AuditScreenshotObservation => ({
  position,
  url: `https://example.test/${position}.png`,
  captionText: "Caption",
  captionReadable: true,
  captionLanguage: "en",
  message: "feature",
  keywordHits: [],
  ...extra,
});

describe("screenshotSummary", () => {
  it("counts readable captions, benefit messages and keyword hits", () => {
    expect(
      screenshotSummary([
        shot(1, { message: "benefit", keywordHits: ["geo quiz"] }),
        shot(2),
        shot(3, { captionReadable: false, captionText: null }),
      ]),
    ).toBe(
      "2 of 3 captions readable · 1 leads with a benefit · 1 carries a tracked keyword",
    );
  });

  it("agrees its verbs with the counts", () => {
    expect(
      screenshotSummary([
        shot(1, { message: "benefit", keywordHits: ["a"] }),
        shot(2, { message: "benefit", keywordHits: ["b", "c"] }),
      ]),
    ).toBe(
      "2 of 2 captions readable · 2 lead with a benefit · 2 carry a tracked keyword",
    );
    expect(screenshotSummary([shot(1)])).toBe(
      "1 of 1 caption readable · 0 lead with a benefit · 0 carry a tracked keyword",
    );
  });
});
