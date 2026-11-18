"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addKeywords, ApiError } from "@/lib/api";
import { invalidateKeywordMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  TRACK_SELECTED_FAILED,
  trackingSelectedMessage,
  trackSelectedLabel,
} from "./suggestion-selection";

export function TrackSelectedSuggestions({
  id,
  country,
  ticked,
  onTracked,
}: {
  id: string;
  country: string;
  ticked: string[];
  onTracked: (texts: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const track = useMutation({
    mutationFn: (texts: string[]) => addKeywords(id, texts, country),
    onSuccess: (_items, texts) => {
      invalidateKeywordMutation(queryClient, id);
      onTracked(texts);
      toast.success(trackingSelectedMessage(texts.length));
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : TRACK_SELECTED_FAILED,
      ),
  });
  const trackOnce = useSingleFlight(track);

  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={ticked.length === 0 || track.isPending || undefined}
      onClick={() => {
        if (ticked.length > 0) trackOnce(ticked);
      }}
    >
      {track.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
      {trackSelectedLabel(ticked.length)}
    </Button>
  );
}
