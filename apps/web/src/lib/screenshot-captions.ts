import type { AppScreenshots, ScreenshotCaptionStatus } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enScreenshots from "../../messages/en/screenshots.json";
import type { MessageTranslator } from "@/i18n/translator";
import { PRODUCT_NAME } from "./brand";

const english = createTranslator({
  locale: "en",
  namespace: "screenshots",
  messages: { screenshots: enScreenshots },
});

export const CAPTION_STATUS_LABELS: Record<ScreenshotCaptionStatus, string> = {
  pending: "Reading",
  read: "Caption read",
  blank: "No caption",
  failed: "Could not read",
  skipped: "Not read",
};

export function captionStatusLabel(
  status: ScreenshotCaptionStatus,
  t: MessageTranslator = english,
): string {
  return t(`status.${status}`);
}

export const SCREENSHOT_POLL_MS = 5_000;

export function hasPendingScreenshots(
  data: AppScreenshots | undefined,
): boolean {
  return data?.screenshots.some((item) => item.status === "pending") ?? false;
}

export function screenshotSummary(
  data: AppScreenshots,
  t: MessageTranslator = english,
): string {
  if (data.reading === "unsupported") {
    return t("summary.unsupported", { product: PRODUCT_NAME });
  }
  if (data.reading === "off") {
    return t("summary.off");
  }
  const total = data.screenshots.length;
  if (total === 0) {
    return t("summary.empty");
  }
  const settled = data.screenshots.filter(
    (item) => item.status !== "pending",
  ).length;
  if (settled < total) {
    return t("summary.pending", { settled, total });
  }
  const read = data.screenshots.filter((item) => item.caption !== null).length;
  return t("summary.settled", { read, total });
}
