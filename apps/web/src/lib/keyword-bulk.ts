import {
  KEYWORD_BULK_CHANGE_LIMIT,
  type KeywordBulkAction,
  type KeywordBulkResult,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../messages/en/keywords.json";
import { ApiError } from "@/lib/api/client";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

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

const ACTION_KEYS: Record<KeywordBulkAction, string> = {
  pause: "pauseAction",
  resume: "resumeAction",
  untrack: "untrackAction",
};

const DONE_KEYS: Record<KeywordBulkAction, string> = {
  pause: "paused",
  resume: "activated",
  untrack: "stoppedTracking",
};

const STATE_KEYS: Record<KeywordBulkAction, string | null> = {
  pause: "alreadyPaused",
  resume: "alreadyActive",
  untrack: null,
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
  t: MessageTranslator,
): BulkReport {
  const description =
    outcome.error instanceof ApiError
      ? outcome.error.envelope.message
      : undefined;
  return outcome.notSent === selected
    ? {
        level: "error",
        message: t("bulk.failure", {
          action: t(`bulk.${ACTION_KEYS[action]}`),
          count: selected,
        }),
        description,
      }
    : {
        level: "warning",
        message: t("bulk.partial", {
          done: t(`bulk.${DONE_KEYS[action]}`),
          changed: outcome.changed,
          notSent: outcome.notSent,
        }),
        description,
      };
}

export function bulkReport(
  action: KeywordBulkAction,
  outcome: BulkOutcome,
  selected: number,
  t: MessageTranslator = english,
): BulkReport {
  if (outcome.error !== undefined) {
    return failureReport(action, outcome, selected, t);
  }
  const stateKey = STATE_KEYS[action];
  const notes = [
    outcome.unchanged > 0 && stateKey
      ? t(`bulk.${stateKey}`, { count: outcome.unchanged })
      : null,
    outcome.missing > 0
      ? t("bulk.noLongerTracked", { count: outcome.missing })
      : null,
  ].filter((note): note is string => note !== null);
  return {
    level: outcome.changed > 0 ? "success" : "info",
    message: [
      t("bulk.changed", {
        done: t(`bulk.${DONE_KEYS[action]}`),
        count: outcome.changed,
      }),
      ...notes,
    ].join(t("bulk.separator")),
  };
}
