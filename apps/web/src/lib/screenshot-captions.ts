import type { AppScreenshots, ScreenshotCaptionStatus } from "@asobeast/shared";
import { PRODUCT_NAME } from "./brand";

export const CAPTION_STATUS_LABELS: Record<ScreenshotCaptionStatus, string> = {
  pending: "Reading",
  read: "Caption read",
  blank: "No caption",
  failed: "Could not read",
  skipped: "Not read",
};

export const SCREENSHOT_POLL_MS = 5_000;

export function hasPendingScreenshots(
  data: AppScreenshots | undefined,
): boolean {
  return data?.screenshots.some((item) => item.status === "pending") ?? false;
}

export function screenshotSummary(data: AppScreenshots): string {
  if (data.reading === "unsupported") {
    return `Google Play does not index screenshot text, so ${PRODUCT_NAME} does not read it.`;
  }
  if (data.reading === "off") {
    return "Reading screenshot text is switched off on this instance.";
  }
  const total = data.screenshots.length;
  if (total === 0) {
    return "No screenshots recorded yet. Refresh the app to capture them.";
  }
  const settled = data.screenshots.filter(
    (item) => item.status !== "pending",
  ).length;
  if (settled < total) {
    return `Reading ${settled} of ${total} screenshots. This page updates when they are done.`;
  }
  const read = data.screenshots.filter((item) => item.caption !== null).length;
  return `${read} of ${total} screenshots carry a caption.`;
}
