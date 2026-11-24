"use client";

import { useQueryStates } from "nuqs";
import type {
  AppStoreLocalization,
  MetadataDraft,
  Store,
} from "@asobeast/shared";
import { useMarket } from "@/components/app-detail/use-market";
import { armFocusHandoff } from "@/lib/focus-handoff";
import {
  draftScopeOf,
  draftView,
  isListingDraftField,
  scopeKey,
  writeListingDraftField,
} from "@/lib/listing-draft";
import {
  localizationParser,
  marketParser,
  metadataModeParser,
} from "@/lib/search-params";
import { draftFieldFocusKey, draftFieldSelector } from "./DraftFieldInput";

export function useDraftFill(
  appId: string,
  store: Store,
  drafted: AppStoreLocalization | null,
): ((draft: MetadataDraft) => void) | null {
  const { home, markets } = useMarket(appId);
  const [, setQuery] = useQueryStates({
    mode: metadataModeParser,
    market: marketParser,
    localization: localizationParser,
  });
  const view = draftView(home, drafted, markets);
  if (view === null) return null;

  return (draft) => {
    const field = draft.field;
    if (!isListingDraftField(field)) return;
    const scope = draftScopeOf(
      store,
      view.market,
      view.localization ?? undefined,
    );
    writeListingDraftField(appId, scopeKey(scope), field, draft.value);
    armFocusHandoff(draftFieldFocusKey(field));
    void setQuery(
      {
        mode: "draft",
        market: view.market === home ? null : view.market,
        localization: view.localization,
      },
      { history: "push" },
    ).then(() =>
      document.querySelector<HTMLElement>(draftFieldSelector(field))?.focus(),
    );
  };
}
