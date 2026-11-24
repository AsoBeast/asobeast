"use client";

import type { AppStoreLocalization } from "@asobeast/shared";
import { listingDraftKey, parseListingDraft } from "@/lib/listing-draft";
import { localizationName } from "@/lib/localizations";
import { useStoredPreference } from "@/lib/use-stored-preference";

export interface DraftedField {
  localization: AppStoreLocalization;
  state: "ready" | "missing" | "managed";
  text: string | undefined;
}

export function useDraftedField(
  appId: string,
  localization: AppStoreLocalization | null,
  managed: boolean,
): DraftedField | null {
  const [raw] = useStoredPreference(listingDraftKey(appId, localization ?? ""));
  if (localization === null) return null;
  if (managed) return { localization, state: "managed", text: undefined };
  const text = parseListingDraft(raw)?.keywordField;
  return {
    localization,
    state: text === undefined ? "missing" : "ready",
    text,
  };
}

function sentence({ localization, state }: DraftedField): string {
  switch (state) {
    case "ready":
      return "Your drafted keyword field is ready to review and save.";
    case "missing":
      return "This browser holds no drafted keyword field for this localization.";
    case "managed":
      return `Your drafted keyword field was not handed over, because App Store Connect manages the ${localizationName(localization)} keyword field.`;
  }
}

export function DraftedFieldStatus({ handoff }: { handoff: DraftedField }) {
  return (
    <p
      role="status"
      className="border-b border-border px-4 py-3 text-dense text-muted-foreground"
    >
      {sentence(handoff)}
    </p>
  );
}
