import { isCheckFresh, type TrackedKeywordItem } from "@asobeast/shared";

export const FIRST_CHECK_POLL_MS = 15_000;
export const FIRST_CHECK_POLL_LIMIT = 40;

export const isChecking = (
  row: Pick<TrackedKeywordItem, "active" | "latestDepth">,
): boolean => row.active && row.latestDepth === null;

export const staleCheckDay = (
  row: Pick<TrackedKeywordItem, "active" | "latestCheckedOn">,
  today: string,
): string | null =>
  row.active &&
  typeof row.latestCheckedOn === "string" &&
  !isCheckFresh(row.latestCheckedOn, today)
    ? row.latestCheckedOn
    : null;

export function keywordsPollInterval(
  rows: readonly TrackedKeywordItem[] | undefined,
  updates: number,
): number | false {
  if (!rows || updates >= FIRST_CHECK_POLL_LIMIT) return false;
  return rows.some(isChecking) ? FIRST_CHECK_POLL_MS : false;
}
