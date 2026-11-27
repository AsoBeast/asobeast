"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MessageTranslator } from "@/i18n/translator";
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

function errorMessage(error: unknown, t: MessageTranslator): string {
  return error instanceof ApiError
    ? error.envelope.message
    : t("combinations.trackFailed");
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
  const t = useTranslations("keywords");
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string[] | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const trackShown = useRef<HTMLButtonElement>(null);
  const confirm = (phrases: string[], button: HTMLButtonElement) => {
    opener.current = button;
    setPending(phrases);
  };
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
        toast.success(
          t("combinations.tracking", {
            count: keywordCount(outcome.tracked, t),
          }),
        );
        return;
      }
      toast.error(errorMessage(outcome.error, t), {
        description:
          outcome.tracked > 0
            ? t("combinations.partialTracked", {
                tracked: outcome.tracked,
                total: phrases.length,
              })
            : undefined,
      });
    },
  });
  const trackOnce = useSingleFlight(track);

  const busy = track.isPending;

  return (
    <>
      {selected.length > 0 ? (
        <Button
          size="sm"
          variant="outline"
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (!busy) confirm(selected, event.currentTarget);
          }}
        >
          {t("combinations.trackSelected", { count: selected.length })}
        </Button>
      ) : null}
      <Button
        ref={trackShown}
        size="sm"
        variant="outline"
        aria-disabled={shown.length === 0 || busy || undefined}
        onClick={(event) => {
          if (shown.length > 0 && !busy) confirm(shown, event.currentTarget);
        }}
      >
        {t("combinations.trackShown", { count: shown.length })}
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
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const survivor = opener.current?.isConnected
            ? opener.current
            : trackShown.current;
          survivor?.focus();
        }}
      />
    </>
  );
}
