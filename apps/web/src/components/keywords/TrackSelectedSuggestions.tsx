"use client";

import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addKeywords, ApiError } from "@/lib/api";
import { invalidateKeywordMutation } from "@/lib/queries";
import {
  TRACK_SELECTED_FAILED,
  trackingSelectedMessage,
  trackSelectedLabel,
} from "./suggestion-selection";

export interface TrackSelectedRequest {
  texts: string[];
  scope: string;
}

export function useTrackSelected(
  id: string,
  country: string,
  onTracked: (texts: readonly string[], scope: string) => void,
) {
  const queryClient = useQueryClient();
  const mutationKey = ["track-selected", id, country];
  const track = useMutation({
    mutationKey,
    mutationFn: ({ texts }: TrackSelectedRequest) =>
      addKeywords(id, texts, country),
    onSuccess: (_items, { texts, scope }) => {
      invalidateKeywordMutation(queryClient, id);
      onTracked(texts, scope);
      toast.success(trackingSelectedMessage(texts.length));
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : TRACK_SELECTED_FAILED,
      ),
  });
  const pending = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as TrackSelectedRequest | undefined)?.texts ??
      [],
  });
  return {
    busy: pending.length > 0,
    sending: pending.flat(),
    trackOnce: (request: TrackSelectedRequest) => {
      if (queryClient.isMutating({ mutationKey }) === 0) track.mutate(request);
    },
  };
}

export function TrackSelectedButton({
  count,
  busy,
  onTrack,
}: {
  count: number;
  busy: boolean;
  onTrack: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={count === 0 || busy || undefined}
      onClick={() => {
        if (count > 0 && !busy) onTrack();
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Plus />}
      {trackSelectedLabel(count)}
    </Button>
  );
}
