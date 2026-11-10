import type { KeywordInspectionSummary } from "@asobeast/shared";
import { isNotFound } from "./api";

export const KEYWORD_INSPECTION_POLL_MS = 2000;

type PolledRun = Pick<KeywordInspectionSummary, "status">;

interface PollState<T> {
  data: T | undefined;
  error: unknown;
}

const gone = (state: PollState<unknown>): boolean => isNotFound(state.error);

export function inspectionListPollInterval(
  state: PollState<{ items: readonly PolledRun[] }>,
): number | false {
  if (gone(state) || !state.data) return false;
  return state.data.items.some((item) => item.status === "PENDING")
    ? KEYWORD_INSPECTION_POLL_MS
    : false;
}

export function inspectionPollInterval(
  state: PollState<PolledRun>,
): number | false {
  if (gone(state) || !state.data) return false;
  return state.data.status === "PENDING" ? KEYWORD_INSPECTION_POLL_MS : false;
}
