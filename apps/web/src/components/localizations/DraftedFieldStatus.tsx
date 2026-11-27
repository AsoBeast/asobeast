"use client";

import { useState } from "react";
import type { AppStoreLocalization } from "@asobeast/shared";
import { listingDraftKey, parseListingDraft } from "@/lib/listing-draft";
import { localizationName } from "@/lib/localizations";
import { useStoredPreference } from "@/lib/use-stored-preference";
import {
  handoffGenerationsOf,
  nextHandoffGenerations,
  type HandoffGenerations,
} from "./handoff-generations";

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

export function useHandoffGenerations(
  handoff: DraftedField | null,
): HandoffGenerations {
  const target = handoff?.state === "ready" ? handoff.localization : null;
  const [seen, setSeen] = useState(() => handoffGenerationsOf(target));
  if (seen.target !== target) {
    setSeen(nextHandoffGenerations(seen, target));
  }
  return seen;
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
