import type {
  CompetitorSuggestion,
  CompetitorSuggestions,
  SimilarLookupState,
  Store,
} from "@asobeast/shared";
import { pluralize } from "@/lib/format";

const SIMILAR_ON: Record<Store, string> = {
  APP_STORE: "Similar on the App Store",
  GOOGLE_PLAY: "Similar on Google Play",
};

export function discoveredRows(
  suggestions: CompetitorSuggestions | undefined,
): CompetitorSuggestion[] {
  return suggestions?.items ?? [];
}

export function suggestionMeta(
  row: CompetitorSuggestion,
  store: Store,
): string {
  if (row.source === "similar") return SIMILAR_ON[store];
  return `${pluralize(row.appearances ?? 0, "appearance")} · best #${row.bestPosition}`;
}

export function addButtonLabel(count: number): string {
  return count === 0 ? "Add selected" : `Add ${count} selected`;
}

export function discoveredEmptyText(
  collecting: boolean,
  similar: SimilarLookupState,
): string {
  if (collecting) {
    return "Positions are still being collected. Apps that rank for your keywords appear here within minutes.";
  }
  return similar === "unavailable"
    ? "The store did not list similar apps right now."
    : "No suggestions yet.";
}
