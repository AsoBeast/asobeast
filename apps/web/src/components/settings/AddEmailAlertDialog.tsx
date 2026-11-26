"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RATING_DROP_DEFAULT_TENTHS, REVIEW_SCORES } from "@asobeast/shared";
import type { WebhookEvent } from "@asobeast/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createEmailAlert } from "@/lib/api";
import { invalidateEmailAlertMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  DEFAULT_ALERT_EVENTS,
  DEFAULT_RANK_TEXT,
  needsAStar,
  ratingDropTenthsToSend,
  reviewScoresToSend,
} from "./alert-event-copy";
import { rankThresholdError, rankThresholdToSend } from "./alert-thresholds";
import { AlertRules } from "./alert-rules/AlertRules";
import { ConfirmDropsField } from "./ConfirmDropsField";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";
import { awaitsConfirmation, recipientToast } from "./email-alert-recipient";

export function AddEmailAlertDialog({ trigger }: { trigger?: ReactNode }) {
  const t = useTranslations("notifications");
  const validation = useTranslations("validation");
  const invalidAddress = validation("notifications.invalidEmail");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([
    ...DEFAULT_ALERT_EVENTS,
  ]);
  const [stars, setStars] = useState<number[]>([...REVIEW_SCORES]);
  const [ratingTenths, setRatingTenths] = useState(RATING_DROP_DEFAULT_TENTHS);
  const [rankText, setRankText] = useState(DEFAULT_RANK_TEXT);
  const [confirmDrops, setConfirmDrops] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createEmailAlert({
        email,
        events,
        reviewScores: reviewScoresToSend(events, stars),
        ratingDropTenths: ratingDropTenthsToSend(events, ratingTenths),
        rankDropThreshold: rankThresholdToSend(events, rankText),
        confirmDrops,
      }),
    onSuccess: (saved) => {
      invalidateEmailAlertMutation(queryClient);
      if (saved.confirmationSent === false) {
        toast.warning(
          t("email.addedConfirmationFailed", { email: saved.email }),
          recipientToast(saved),
        );
      } else {
        toast.success(
          awaitsConfirmation(saved)
            ? t("email.confirmationSent", { email: saved.email })
            : t("email.added"),
          recipientToast(saved),
        );
      }
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.envelope.message : t("email.addError"),
      );
    },
  });
  const createOnce = useSingleFlight(mutation);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setEmail("");
    setEvents([...DEFAULT_ALERT_EVENTS]);
    setStars([...REVIEW_SCORES]);
    setRatingTenths(RATING_DROP_DEFAULT_TENTHS);
    setRankText(DEFAULT_RANK_TEXT);
    setConfirmDrops(true);
    setError(null);
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(invalidAddress);
      return;
    }
    if (events.length === 0) {
      setError(validation("notifications.ruleRequired"));
      return;
    }
    if (needsAStar(events, stars)) {
      setError(validation("notifications.starRequired"));
      return;
    }
    const thresholdError = rankThresholdError(events, rankText, validation);
    if (thresholdError) {
      setError(thresholdError);
      return;
    }

    createOnce();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("email.add")}
      description={t("email.addDescription")}
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
      trigger={trigger}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email-alert-address">{t("email.recipient")}</Label>
        <Input
          id="email-alert-address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="alerts@example.com"
          aria-invalid={error === invalidAddress}
        />
      </div>

      <AlertRules
        events={events}
        stars={stars}
        ratingTenths={ratingTenths}
        rankText={rankText}
        onEventsChange={setEvents}
        onStarsChange={setStars}
        onRatingTenthsChange={setRatingTenths}
        onRankTextChange={setRankText}
      />

      <ConfirmDropsField checked={confirmDrops} onChange={setConfirmDrops} />
    </AlertChannelDialog>
  );
}
