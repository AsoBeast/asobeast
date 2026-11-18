import type { KeywordSuggestionStrategy } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

export const NOTHING_TICKED: ReadonlySet<string> = new Set();

export function trackSelectedLabel(count: number): string {
  return count === 0 ? "Track selected" : `Track ${count} selected`;
}

export function trackingSelectedMessage(count: number): string {
  return `Tracking ${pluralize(count, "keyword")}. Positions arrive within minutes.`;
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

export const TRACK_SELECTED_FAILED = "Could not track the selected keywords";

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
