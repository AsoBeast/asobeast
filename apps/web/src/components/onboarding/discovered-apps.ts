import type {
  CompetitorSuggestion,
  CompetitorSuggestions,
  SimilarLookupState,
  Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enSetup from "../../../messages/en/setup.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "setup",
  messages: { setup: enSetup },
});

export function discoveredRows(
  suggestions: CompetitorSuggestions | undefined,
): CompetitorSuggestion[] {
  return suggestions?.items ?? [];
}

export function suggestionMeta(
  row: CompetitorSuggestion,
  store: Store,
  t: MessageTranslator = english,
): string {
  if (row.source === "similar") {
    return t(
      store === "APP_STORE"
        ? "discovered.similarAppStore"
        : "discovered.similarGooglePlay",
    );
  }
  return t("discovered.appearances", {
    count: row.appearances ?? 0,
    position: row.bestPosition ?? 0,
  });
}

export function addButtonLabel(
  count: number,
  t: MessageTranslator = english,
): string {
  return count === 0
    ? t("discovered.addSelected")
    : t("discovered.addSelectedCount", { count });
}

export function discoveredEmptyText(
  collecting: boolean,
  similar: SimilarLookupState,
  t: MessageTranslator = english,
): string {
  if (collecting) return t("discovered.collecting");
  return similar === "unavailable"
    ? t("discovered.unavailable")
    : t("discovered.none");
}
