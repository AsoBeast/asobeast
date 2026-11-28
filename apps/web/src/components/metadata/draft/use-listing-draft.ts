"use client";

import { useMemo } from "react";
import {
  changedFields,
  draftValues,
  listingDraftKey,
  parseListingDraft,
  writeListingDraftField,
  type ListingDraftField,
  type ListingDraftValues,
} from "@/lib/listing-draft";
import { useStoredPreference } from "@/lib/use-stored-preference";

export function useListingDraft(
  appId: string,
  scope: string,
  live: ListingDraftValues,
) {
  const [raw, save] = useStoredPreference(listingDraftKey(appId, scope));
  const stored = useMemo(() => parseListingDraft(raw), [raw]);
  const values = useMemo(() => draftValues(stored, live), [stored, live]);
  const setField = (field: ListingDraftField, value: string) =>
    writeListingDraftField(appId, scope, field, value);
  const reset = () => {
    const before = raw ?? "";
    save("");
    return () => save(before);
  };
  return {
    values,
    changed: changedFields(values, live),
    setField,
    reset,
  } as const;
}
