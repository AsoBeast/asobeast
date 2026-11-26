import type { AuditScreenshotObservation } from "@asobeast/shared";
import type { Locale } from "@/lib/locale";

const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export function screenshotSummary(
  screenshots: AuditScreenshotObservation[],
  locale: Locale = "en",
): string {
  const readable = screenshots.filter((shot) => shot.captionReadable).length;
  const benefit = screenshots.filter(
    (shot) => shot.message === "benefit",
  ).length;
  const keyword = screenshots.filter(
    (shot) => shot.keywordHits.length > 0,
  ).length;
  if (locale === "zh-CN") {
    return [
      `${readable} / ${screenshots.length} 张截图说明可读`,
      `${benefit} 张突出优势`,
      `${keyword} 张包含已跟踪关键词`,
    ].join(" · ");
  }
  return [
    `${readable} of ${counted(screenshots.length, "caption", "captions")} readable`,
    counted(benefit, "leads with a benefit", "lead with a benefit"),
    counted(keyword, "carries a tracked keyword", "carry a tracked keyword"),
  ].join(" · ");
}
