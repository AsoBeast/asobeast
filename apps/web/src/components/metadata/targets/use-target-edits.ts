"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LISTING_TARGET_LIMIT,
  type AppStoreLocalization,
  type ListingTargetsRequest,
  type ListingTargetsResult,
  type ListingTargetsSaveResult,
} from "@asobeast/shared";
import { apiErrorMessage, saveListingTargets } from "@/lib/api";
import {
  isEdited,
  saveRequestOf,
  savedSentence,
  savedSlots,
  type TargetSlots,
} from "@/lib/listing-targets";
import {
  appKeys,
  invalidateListingTargetsMutation,
  listingTargetsOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

const NO_SLOTS: TargetSlots = Array<null>(LISTING_TARGET_LIMIT).fill(null);

export function useTargetEdits(id: string, localization: AppStoreLocalization) {
  const queryClient = useQueryClient();
  const read = useQuery(listingTargetsOptions(id, localization));
  const [edits, setEdits] = useState<TargetSlots | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ListingTargetsSaveResult | null>(null);
  const saved = useMemo(
    () => (read.data ? savedSlots(read.data) : NO_SLOTS),
    [read.data],
  );
  const slots = edits ?? saved;
  const key = appKeys.listingTargets(id, localization);

  const mutation = useMutation({
    mutationFn: (request: ListingTargetsRequest) =>
      saveListingTargets(id, localization, request),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      const before = queryClient.getQueryData<ListingTargetsResult>(key);
      queryClient.setQueryData<ListingTargetsResult>(key, result);
      setEdits(null);
      setOutcome(result);
      invalidateListingTargetsMutation(queryClient, id);
      toast.success(savedSentence(before, result));
    },
    onError: (failure) =>
      setError(apiErrorMessage(failure, "Could not save the targets")),
  });
  const send = useSingleFlight(mutation);

  return {
    read,
    slots,
    edited: isEdited(slots, saved),
    saving: mutation.isPending,
    error,
    outcome,
    edit: (next: TargetSlots) => {
      setError(null);
      setOutcome(null);
      setEdits(next);
    },
    discard: () => {
      setError(null);
      setOutcome(null);
      setEdits(null);
    },
    save: (trackMissing = false) => send(saveRequestOf(slots, trackMissing)),
  };
}

export type TargetEdits = ReturnType<typeof useTargetEdits>;
