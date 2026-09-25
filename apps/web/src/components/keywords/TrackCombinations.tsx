"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addKeywords, ApiError } from "@/lib/api";
import {
  phrasesToTrack,
  trackInChunks,
  type TrackOutcome,
} from "@/lib/keyword-combinations";
import { invalidateKeywordMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import type { CombinationTable } from "./CombinationFilters";
import {
  keywordCount,
  TrackCombinationsDialog,
} from "./TrackCombinationsDialog";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.envelope.message
    : "Could not track the keywords";
}

export function TrackCombinations({
  table,
  id,
  homeCountry,
}: {
  table: CombinationTable;
  id: string;
  homeCountry: string;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string[] | null>(null);
  const selected = phrasesToTrack(
    table.getFilteredSelectedRowModel().rows.map((row) => row.original),
  );
  const shown = phrasesToTrack(
    table.getFilteredRowModel().rows.map((row) => row.original),
  );

  const track = useMutation({
    mutationFn: (phrases: string[]) =>
      trackInChunks(phrases, (chunk) => addKeywords(id, chunk, homeCountry)),
    onSuccess: (outcome: TrackOutcome, phrases) => {
      invalidateKeywordMutation(queryClient, id);
      table.resetRowSelection();
      setPending(null);
      if (outcome.ok) {
        toast.success(`Tracking ${keywordCount(outcome.tracked)}`);
        return;
      }
      toast.error(errorMessage(outcome.error), {
        description:
          outcome.tracked > 0
            ? `${outcome.tracked} of ${phrases.length} tracked before this error`
            : undefined,
      });
    },
  });
  const trackOnce = useSingleFlight(track);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={selected.length === 0 || track.isPending}
        onClick={() => setPending(selected)}
      >
        Track selected ({selected.length})
      </Button>
      <Button
        size="sm"
        disabled={shown.length === 0 || track.isPending}
        onClick={() => setPending(shown)}
      >
        Track all shown ({shown.length})
      </Button>
      <TrackCombinationsDialog
        count={pending?.length ?? 0}
        market={homeCountry}
        open={pending !== null}
        pending={track.isPending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={() => pending && trackOnce(pending)}
      />
    </>
  );
}
