"use client";

import { useCallback } from "react";
import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { addKeywords, ApiError } from "@/lib/api";
import { invalidateKeywordMutation } from "@/lib/queries";
import { useKeyedSingleFlight } from "@/lib/single-flight";

export function useTrackSuggestion(id: string, country: string) {
  const queryClient = useQueryClient();
  const trackKey = ["track-suggestion", id, country] as const;
  const track = useMutation({
    mutationKey: trackKey,
    mutationFn: (text: string) => addKeywords(id, [text], country),
    onSuccess: (_data, text) => {
      invalidateKeywordMutation(queryClient, id);
      toast.success(`Tracking ${text}`);
    },
    onError: (error, text) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : `Could not track ${text}`,
      ),
  });
  const trackKeyOf = useCallback(
    (text: string) => JSON.stringify([id, country, text]),
    [id, country],
  );
  const trackOnce = useKeyedSingleFlight(track, trackKeyOf);
  const trackingTexts = useMutationState({
    filters: { mutationKey: trackKey, status: "pending" },
    select: (mutation) => mutation.state.variables,
  }).filter((text): text is string => typeof text === "string");
  return { trackOnce, trackingTexts };
}
