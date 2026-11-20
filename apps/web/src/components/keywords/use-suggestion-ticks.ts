"use client";

import { useState } from "react";
import {
  NOTHING_TICKED,
  type SuggestionSelection,
  tickedIn,
  withoutTicks,
  withTick,
} from "./suggestion-selection";

export function useSuggestionTicks(
  scope: string,
  shown: readonly string[],
  tracked: ReadonlySet<string>,
) {
  const [selection, setSelection] = useState<SuggestionSelection>({
    scope,
    texts: NOTHING_TICKED,
  });
  if (selection.scope !== scope) {
    setSelection({ scope, texts: NOTHING_TICKED });
  }
  const toggle = (text: string, on: boolean) =>
    setSelection((current) => ({
      ...current,
      texts: withTick(current.texts, text, on),
    }));
  const untick = (sent: readonly string[], sentScope: string) =>
    setSelection((current) => withoutTicks(current, sent, sentScope));

  return {
    ticked: tickedIn(selection, scope, shown, tracked),
    toggle,
    untick,
  };
}
