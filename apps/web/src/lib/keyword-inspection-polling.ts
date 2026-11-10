import type { KeywordInspectionSummary } from "@asobeast/shared";
import { isNotFound } from "./api";
import { FIRST_CHECK_POLL_LIMIT, FIRST_CHECK_POLL_MS } from "./keyword-checks";

export const KEYWORD_INSPECTION_POLL_MS = FIRST_CHECK_POLL_MS;
export const KEYWORD_INSPECTION_POLL_LIMIT = FIRST_CHECK_POLL_LIMIT;
export const KEYWORD_INSPECTION_POLL_WINDOW_MS =
  KEYWORD_INSPECTION_POLL_MS * KEYWORD_INSPECTION_POLL_LIMIT;

type PolledRun = Pick<KeywordInspectionSummary, "status" | "requestedAt">;

interface PollState<T> {
  data: T | undefined;
  error: unknown;
  dataUpdateCount: number;
}

const gone = (state: PollState<unknown>): boolean => isNotFound(state.error);

const recentlyRequested = (run: PolledRun, now: number): boolean =>
  run.status === "PENDING" &&
  now - Date.parse(run.requestedAt) < KEYWORD_INSPECTION_POLL_WINDOW_MS;

export function inspectionListPollInterval(
  state: PollState<{ items: readonly PolledRun[] }>,
  now: number = Date.now(),
): number | false {
  if (gone(state) || !state.data) return false;
  return state.data.items.some((item) => recentlyRequested(item, now))
    ? KEYWORD_INSPECTION_POLL_MS
    : false;
}

export function inspectionPollInterval(
  state: PollState<Pick<PolledRun, "status">>,
): number | false {
  if (gone(state) || !state.data) return false;
  if (state.dataUpdateCount >= KEYWORD_INSPECTION_POLL_LIMIT) return false;
  return state.data.status === "PENDING" ? KEYWORD_INSPECTION_POLL_MS : false;
}
