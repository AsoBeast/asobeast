import type { KeywordSuggestionStrategy } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const NOTHING_TICKED: ReadonlySet<string> = new Set();

export function trackSelectedLabel(
  count: number,
  t: MessageTranslator = english,
): string {
  return count === 0
    ? t("suggestions.trackSelected")
    : t("suggestions.trackSelectedCount", { count });
}

export function trackingSelectedMessage(
  count: number,
  t: MessageTranslator = english,
): string {
  return t("suggestions.trackingSelected", { count });
}

export function withTick(
  ticked: ReadonlySet<string>,
  text: string,
  on: boolean,
): ReadonlySet<string> {
  const next = new Set(ticked);
  if (on) next.add(text);
  else next.delete(text);
  return next;
}

export const TRACK_SELECTED_FAILED = enKeywords.suggestions.trackSelectedFailed;

export interface SuggestionSelection {
  scope: string;
  texts: ReadonlySet<string>;
}

export const selectionScope = (
  country: string,
  strategy: KeywordSuggestionStrategy,
): string => `${country}:${strategy}`;

export function tickedIn(
  selection: SuggestionSelection,
  scope: string,
  shown: readonly string[],
  tracked: ReadonlySet<string>,
): string[] {
  if (selection.scope !== scope) return [];
  return shown.filter(
    (text) => selection.texts.has(text) && !tracked.has(text),
  );
}

export const withoutTicks = (
  selection: SuggestionSelection,
  sent: readonly string[],
  sentScope: string,
): SuggestionSelection =>
  selection.scope === sentScope
    ? {
        scope: selection.scope,
        texts: new Set(
          [...selection.texts].filter((text) => !sent.includes(text)),
        ),
      }
    : selection;
