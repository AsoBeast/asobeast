import { describe, expect, it } from "vitest";
import {
  SCREENSHOT_CAPTION_STATUSES,
  type AppScreenshots,
  type ScreenshotItem,
} from "@asobeast/shared";
import {
  CAPTION_STATUS_LABELS,
  hasPendingScreenshots,
  screenshotSummary,
} from "./screenshot-captions";

const item = (
  position: number,
  status: ScreenshotItem["status"],
  caption: string | null = null,
): ScreenshotItem => ({
  position,
  url: `https://x/${position}`,
  caption,
  status,
});

const screenshots = (
  reading: AppScreenshots["reading"],
  items: ScreenshotItem[],
): AppScreenshots => ({
  appId: "a",
  store: "APP_STORE",
  snapshotId: "s",
  capturedAt: "2026-10-07T03:00:00.000Z",
  reading,
  screenshots: items,
});

describe("CAPTION_STATUS_LABELS", () => {
  it("words every state a screenshot can be in", () => {
    for (const status of SCREENSHOT_CAPTION_STATUSES) {
      expect(CAPTION_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("never says a blank screenshot failed", () => {
    expect(CAPTION_STATUS_LABELS.blank).toBe("No caption");
    expect(CAPTION_STATUS_LABELS.failed).toBe("Could not read");
  });
});

describe("hasPendingScreenshots", () => {
  it("is true while any screenshot is pending", () => {
    expect(
      hasPendingScreenshots(
        screenshots("on", [item(1, "read", "a"), item(2, "pending")]),
      ),
    ).toBe(true);
  });

  it("is false once everything settled and for no data", () => {
    expect(
      hasPendingScreenshots(screenshots("on", [item(1, "read", "a")])),
    ).toBe(false);
    expect(hasPendingScreenshots(undefined)).toBe(false);
  });
});

describe("screenshotSummary", () => {
  it("counts the captions read", () => {
    expect(
      screenshotSummary(
        screenshots("on", [
          item(1, "read", "a"),
          item(2, "blank"),
          item(3, "read", "b"),
        ]),
      ),
    ).toBe("2 of 3 screenshots carry a caption.");
  });

  it("says how many are still being read", () => {
    expect(
      screenshotSummary(
        screenshots("on", [item(1, "read", "a"), item(2, "pending")]),
      ),
    ).toBe("Reading 1 of 2 screenshots. This page updates when they are done.");
  });

  it("explains a switched off reader and an unsupported store", () => {
    expect(screenshotSummary(screenshots("off", [item(1, "skipped")]))).toBe(
      "Reading screenshot text is switched off on this instance.",
    );
    expect(screenshotSummary(screenshots("unsupported", []))).toBe(
      "Google Play does not index screenshot text, so AsoBeast does not read it.",
    );
  });

  it("says so when no screenshot is recorded yet", () => {
    expect(screenshotSummary(screenshots("on", []))).toBe(
      "No screenshots recorded yet. Refresh the app to capture them.",
    );
  });
});
