import type { KeywordCoverageRow, ScreenshotTextState } from "@asobeast/shared";

export type ScreenshotTextMark = "covered" | "missing" | "unread";

export function screenshotTextMark(
  row: KeywordCoverageRow,
): ScreenshotTextMark {
  const coverage = row.screenshotText;
  if (coverage === null || coverage === undefined) return "unread";
  return coverage.covered ? "covered" : "missing";
}

export function showsScreenshotText(
  rows: readonly KeywordCoverageRow[],
  state: ScreenshotTextState | null,
): boolean {
  return (
    state?.status === "ready" ||
    rows.some((row) => screenshotTextMark(row) !== "unread")
  );
}
