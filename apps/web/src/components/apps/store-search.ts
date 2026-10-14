import {
  parseStoreUrl,
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

const URL_SHAPE = /[/:]/;

export function isStoreAddress(value: string): boolean {
  return URL_SHAPE.test(value.trim());
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

export function isSearchable(input: StoreInput): input is {
  kind: "name";
  q: string;
} {
  return input.kind === "name" && input.q.length >= STORE_SEARCH_MIN_CHARS;
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
  }
  return "Could not search the store.";
}
