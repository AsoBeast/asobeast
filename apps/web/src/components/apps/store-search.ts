import {
  countMaxLengthChars,
  parseStoreUrl,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  type ParsedStoreUrl,
  type StoreSearchResult,
} from "@asobeast/shared";
import { ApiError } from "@/lib/api";

export const STORE_SEARCH_MIN_CHARS = 2;
export const STORE_SEARCH_DEBOUNCE_MS = 400;

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

export function classifyInput(value: string): StoreInput {
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "empty" };
  try {
    return { kind: "url", parsed: parseStoreUrl(trimmed) };
  } catch (error) {
    if (isStoreAddress(trimmed)) {
      return {
        kind: "invalid",
        message: error instanceof Error ? error.message : "Unrecognized URL",
      };
    }
    return { kind: "name", q: trimmed };
  }
}

export function nameTooLongText(input: StoreInput): string | null {
  if (input.kind !== "name") return null;
  const used = countMaxLengthChars(input.q);
  return used > STORE_SEARCH_QUERY_MAX_LENGTH
    ? `Search with up to ${STORE_SEARCH_QUERY_MAX_LENGTH} characters. This name has ${used}.`
    : null;
}

export function isSearchable(input: StoreInput): input is {
  kind: "name";
  q: string;
} {
  return (
    input.kind === "name" &&
    input.q.length >= STORE_SEARCH_MIN_CHARS &&
    nameTooLongText(input) === null
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

export function searchErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.envelope.statusCode === 429) return error.envelope.message;
    if (error.envelope.statusCode === 502) {
      return "The store did not answer. Try again in a moment.";
    }
    if (error.envelope.statusCode === 400) {
      return "This name cannot be searched. Change it and try again.";
    }
  }
  return "Could not search the store.";
}

export function searchRetryable(error: unknown): boolean {
  return !(error instanceof ApiError && error.envelope.statusCode === 400);
}
