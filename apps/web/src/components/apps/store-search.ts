import {
  countMaxLengthChars,
  parseStoreUrl,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  type ParsedStoreUrl,
  type StoreSearchResult,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enApps from "../../../messages/en/apps.json";
import type { MessageTranslator } from "@/i18n/translator";
import { ApiError } from "@/lib/api";

export const STORE_SEARCH_MIN_CHARS = 2;
export const STORE_SEARCH_DEBOUNCE_MS = 400;

const english = createTranslator({
  locale: "en",
  namespace: "apps",
  messages: { apps: enApps },
});

export type StoreInput =
  | { kind: "empty" }
  | { kind: "url"; parsed: ParsedStoreUrl }
  | { kind: "invalid"; message: string }
  | { kind: "name"; q: string };

export type EnterAction =
  | { kind: "none" }
  | { kind: "pick"; result: StoreSearchResult }
  | { kind: "focus" };

const STORE_ADDRESS =
  /^(?:https?:\/\/|(?:apps|itunes)\.apple\.com\/|play\.google\.com\/)/i;

export function isStoreAddress(value: string): boolean {
  return STORE_ADDRESS.test(value.trim());
}

export function classifyInput(
  value: string,
  t: MessageTranslator = english,
): StoreInput {
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "empty" };
  try {
    return { kind: "url", parsed: parseStoreUrl(trimmed) };
  } catch {
    if (isStoreAddress(trimmed)) {
      return {
        kind: "invalid",
        message: t("import.invalidAddress", { value: trimmed }),
      };
    }
    return { kind: "name", q: trimmed };
  }
}

const overNameLimit = (input: StoreInput): boolean =>
  input.kind === "name" &&
  countMaxLengthChars(input.q) > STORE_SEARCH_QUERY_MAX_LENGTH;

export function nameTooLongText(
  input: StoreInput,
  t: MessageTranslator = english,
): string | null {
  if (!overNameLimit(input) || input.kind !== "name") return null;
  return t("import.nameTooLong", {
    limit: STORE_SEARCH_QUERY_MAX_LENGTH,
    used: countMaxLengthChars(input.q),
  });
}

export function isSearchable(input: StoreInput): input is {
  kind: "name";
  q: string;
} {
  return (
    input.kind === "name" &&
    input.q.length >= STORE_SEARCH_MIN_CHARS &&
    !overNameLimit(input)
  );
}

export function enterAction(
  results: readonly StoreSearchResult[] | undefined,
  settled: boolean,
): EnterAction {
  if (!settled || !results || results.length === 0) return { kind: "none" };
  if (results.length === 1) return { kind: "pick", result: results[0] };
  return { kind: "focus" };
}

export function searchErrorText(
  error: unknown,
  t: MessageTranslator = english,
): string {
  if (error instanceof ApiError) return error.envelope.message;
  return t("import.searchFailed");
}

export function searchRetryable(error: unknown): boolean {
  return !(error instanceof ApiError && error.envelope.statusCode === 400);
}
