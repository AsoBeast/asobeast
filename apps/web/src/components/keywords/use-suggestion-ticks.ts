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
      scope,
      texts: withTick(
        current.scope === scope ? current.texts : NOTHING_TICKED,
        text,
        on,
      ),
    }));
  const untick = (sent: readonly string[]) =>
    setSelection((current) => withoutTicks(current, sent));

  return {
    ticked: tickedIn(selection, scope, shown, tracked),
    toggle,
    untick,
  };
}
