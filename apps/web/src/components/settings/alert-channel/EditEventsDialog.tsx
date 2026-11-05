"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import {
  RATING_DROP_DEFAULT_TENTHS,
  selectedReviewScores,
} from "@asobeast/shared";
import type { WebhookEvent } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  needsAStar,
  ratingDropTenthsToSend,
  reviewScoresToSend,
  type AlertSubscriptionChange,
} from "../alert-event-copy";
import {
  rankTextOf,
  rankThresholdChange,
  rankThresholdError,
} from "../alert-thresholds";
import { AlertRules } from "../alert-rules/AlertRules";
import { ConfirmDropsField } from "../ConfirmDropsField";

export function EditEventsDialog({
  label,
  events,
  confirmDrops,
  reviewScores,
  ratingDropTenths = RATING_DROP_DEFAULT_TENTHS,
  rankDropThreshold = null,
  pending,
  onSave,
}: {
  label: string;
  events: WebhookEvent[];
  reviewScores?: number[];
  ratingDropTenths?: number;
  rankDropThreshold?: number | null;
  confirmDrops: boolean;
  pending: boolean;
  onSave: (change: AlertSubscriptionChange) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WebhookEvent[]>(events);
  const [stars, setStars] = useState<number[]>(
    selectedReviewScores(reviewScores),
  );
  const [confirming, setConfirming] = useState(confirmDrops);
  const [ratingTenths, setRatingTenths] = useState(ratingDropTenths);
  const [rankText, setRankText] = useState(rankTextOf(rankDropThreshold));
  const blocked =
    selected.length === 0 ||
    needsAStar(selected, stars) ||
    rankThresholdError(selected, rankText) !== null;

  function changeOpen(next: boolean) {
    if (next) {
      setSelected(events);
      setStars(selectedReviewScores(reviewScores));
      setConfirming(confirmDrops);
      setRatingTenths(ratingDropTenths);
      setRankText(rankTextOf(rankDropThreshold));
    }
    setOpen(next);
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (blocked || pending) return;
    const tenths = ratingDropTenthsToSend(selected, ratingTenths);
    const change: AlertSubscriptionChange = {
      events: selected,
      reviewScores: reviewScoresToSend(selected, stars),
      ...(confirming === confirmDrops ? {} : { confirmDrops: confirming }),
      ...(tenths === undefined || tenths === ratingDropTenths
        ? {}
        : { ratingDropTenths: tenths }),
      ...rankThresholdChange(selected, rankText, rankDropThreshold),
    };
    void onSave(change).then(
      () => setOpen(false),
      () => undefined,
    );
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">
          <Pencil />
          Edit rules
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit rules</DialogTitle>
            <DialogDescription>
              Choose the rules that deliver alerts to{" "}
              <span className="break-all text-foreground">{label}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <AlertRules
              events={selected}
              stars={stars}
              ratingTenths={ratingTenths}
              rankText={rankText}
              onEventsChange={setSelected}
              onStarsChange={setStars}
              onRatingTenthsChange={setRatingTenths}
              onRankTextChange={setRankText}
            />
            <ConfirmDropsField checked={confirming} onChange={setConfirming} />
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Switch on at least one rule to save.
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="submit"
              aria-disabled={pending || blocked || undefined}
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save rules
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
