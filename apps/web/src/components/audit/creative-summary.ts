import type { AuditScreenshotObservation } from "@asobeast/shared";

const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export function screenshotSummary(
  screenshots: AuditScreenshotObservation[],
): string {
  const readable = screenshots.filter((shot) => shot.captionReadable).length;
  const benefit = screenshots.filter(
    (shot) => shot.message === "benefit",
  ).length;
  const keyword = screenshots.filter(
    (shot) => shot.keywordHits.length > 0,
  ).length;
  return [
    `${readable} of ${counted(screenshots.length, "caption", "captions")} readable`,
    counted(benefit, "leads with a benefit", "lead with a benefit"),
    counted(keyword, "carries a tracked keyword", "carry a tracked keyword"),
  ].join(" · ");
}
