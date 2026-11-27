"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addKeywords, ApiError } from "@/lib/api";
import { invalidateKeywordMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
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
  const t = useTranslations("keywords");
  const queryClient = useQueryClient();
  const track = useMutation({
    mutationFn: ({ texts }: TrackSelectedRequest) =>
      addKeywords(id, texts, country),
    onSuccess: (_items, { texts, scope }) => {
      invalidateKeywordMutation(queryClient, id);
      onTracked(texts, scope);
      toast.success(trackingSelectedMessage(texts.length, t));
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : t("suggestions.trackSelectedFailed"),
      ),
  });
  return {
    busy: track.isPending,
    sending: track.isPending ? (track.variables?.texts ?? []) : [],
    trackOnce: useSingleFlight(track),
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
  const t = useTranslations("keywords");
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
      {trackSelectedLabel(count, t)}
    </Button>
  );
}
