"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { selectedReviewScores } from "@asobeast/shared";
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
  reviewScoresToSend,
  type AlertSubscriptionChange,
} from "../alert-event-copy";
import { AlertSubscriptionFields } from "../alert-events";
import { ConfirmDropsField } from "../ConfirmDropsField";

export function EditEventsDialog({
  label,
  events,
  confirmDrops,
  reviewScores,
  pending,
  onSave,
}: {
  label: string;
  events: WebhookEvent[];
  reviewScores?: number[];
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
  const blocked = selected.length === 0 || needsAStar(selected, stars);

  function changeOpen(next: boolean) {
    if (next) {
      setSelected(events);
      setStars(selectedReviewScores(reviewScores));
      setConfirming(confirmDrops);
    }
    setOpen(next);
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (blocked) return;
    const change: AlertSubscriptionChange = {
      events: selected,
      reviewScores: reviewScoresToSend(selected, stars),
    };
    void onSave(
      confirming === confirmDrops
        ? change
        : { ...change, confirmDrops: confirming },
    ).then(
      () => setOpen(false),
      () => undefined,
    );
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">
          <Pencil />
          Edit events
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit events</DialogTitle>
            <DialogDescription>
              Choose the events delivered to{" "}
              <span className="break-all text-foreground">{label}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <AlertSubscriptionFields
              events={selected}
              stars={stars}
              onEventsChange={setSelected}
              onStarsChange={setStars}
            />
            <ConfirmDropsField checked={confirming} onChange={setConfirming} />
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select at least one event to save.
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={pending || blocked}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save events
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
