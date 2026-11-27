"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("notifications");
  const validation = useTranslations("validation");
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
    rankThresholdError(selected, rankText, validation) !== null;

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
          {t("rules.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("rules.edit")}</DialogTitle>
            <DialogDescription>
              {t.rich("rules.editDescription", {
                recipient: (chunks) => (
                  <span className="break-all text-foreground">{chunks}</span>
                ),
                label,
              })}
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
              <p className="text-dense text-muted-foreground">
                {t("rules.chooseOne")}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="submit"
              aria-disabled={pending || blocked || undefined}
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              {t("rules.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
