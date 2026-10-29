import {
  KEYWORD_BULK_CHANGE_LIMIT,
  type KeywordBulkAction,
  type KeywordBulkResult,
} from "@asobeast/shared";
import { ApiError } from "@/lib/api/client";
import { pluralize } from "@/lib/format";

export interface BulkOutcome {
  changed: number;
  unchanged: number;
  missing: number;
  notSent: number;
  error?: unknown;
}

export interface BulkReport {
  level: "success" | "info" | "warning" | "error";
  message: string;
  description?: string;
}

const WORDS: Record<
  KeywordBulkAction,
  { done: string; start: string; state: string | null }
> = {
  pause: { done: "Paused", start: "pause", state: "paused" },
  resume: { done: "Activated", start: "activate", state: "active" },
  untrack: { done: "Stopped tracking", start: "stop tracking", state: null },
};

export async function bulkInChunks(
  keywordIds: readonly string[],
  send: (chunk: string[]) => Promise<KeywordBulkResult>,
  size: number = KEYWORD_BULK_CHANGE_LIMIT,
): Promise<BulkOutcome> {
  const outcome: BulkOutcome = {
    changed: 0,
    unchanged: 0,
    missing: 0,
    notSent: 0,
  };
  for (let start = 0; start < keywordIds.length; start += size) {
    try {
      const result = await send(keywordIds.slice(start, start + size));
      outcome.changed += result.changed;
      outcome.unchanged += result.unchanged;
      outcome.missing += result.missing.length;
    } catch (error) {
      return { ...outcome, notSent: keywordIds.length - start, error };
    }
  }
  return outcome;
}

function failureReport(
  action: KeywordBulkAction,
  outcome: BulkOutcome,
  selected: number,
): BulkReport {
  const words = WORDS[action];
  const description =
    outcome.error instanceof ApiError
      ? outcome.error.envelope.message
      : undefined;
  return outcome.changed === 0
    ? {
        level: "error",
        message: `Could not ${words.start} ${pluralize(selected, "keyword")}`,
        description,
      }
    : {
        level: "warning",
        message: `${words.done} ${outcome.changed}, ${outcome.notSent} not changed`,
        description,
      };
}

export function bulkReport(
  action: KeywordBulkAction,
  outcome: BulkOutcome,
  selected: number,
): BulkReport {
  if (outcome.error !== undefined) {
    return failureReport(action, outcome, selected);
  }
  const words = WORDS[action];
  const notes = [
    outcome.unchanged > 0 && words.state
      ? `${outcome.unchanged} already ${words.state}`
      : null,
    outcome.missing > 0 ? `${outcome.missing} no longer tracked` : null,
  ].filter((note) => note !== null);
  return {
    level: outcome.changed > 0 ? "success" : "info",
    message: [
      `${words.done} ${pluralize(outcome.changed, "keyword")}`,
      ...notes,
    ].join(", "),
  };
}
