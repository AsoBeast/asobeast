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
import { ApiError, createWebhook } from "@/lib/api";
import { invalidateWebhookMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  needsAStar,
  ratingDropTenthsToSend,
  reviewScoresToSend,
} from "./alert-event-copy";
import { rankThresholdError, rankThresholdToSend } from "./alert-thresholds";
import { AlertRules } from "./alert-rules/AlertRules";
import { ConfirmDropsField } from "./ConfirmDropsField";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";
import { channelHint, deliversToChat } from "./webhook-channel-copy";

const HINT_ID = "webhook-channel-hint";

export function AddWebhookDialog({ trigger }: { trigger?: ReactNode }) {
  const t = useTranslations("notifications");
  const validation = useTranslations("validation");
  const invalidUrl = validation("notifications.invalidUrl");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["metadata.changed"]);
  const [stars, setStars] = useState<number[]>([...REVIEW_SCORES]);
  const [ratingTenths, setRatingTenths] = useState(RATING_DROP_DEFAULT_TENTHS);
  const [rankText, setRankText] = useState("");
  const [secret, setSecret] = useState("");
  const [confirmChoice, setConfirmChoice] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createWebhook({
        url,
        events,
        reviewScores: reviewScoresToSend(events, stars),
        ratingDropTenths: ratingDropTenthsToSend(events, ratingTenths),
        rankDropThreshold: rankThresholdToSend(events, rankText),
        secret: secret.trim() === "" ? undefined : secret,
        confirmDrops,
      }),
    onSuccess: () => {
      invalidateWebhookMutation(queryClient);
      toast.success(t("webhook.added"));
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.envelope.message : t("webhook.addError"),
      );
    },
  });
  const createOnce = useSingleFlight(mutation);
  const hint = channelHint(url, t);
  const confirmDrops = confirmChoice ?? deliversToChat(url);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setUrl("");
    setEvents(["metadata.changed"]);
    setStars([...REVIEW_SCORES]);
    setRatingTenths(RATING_DROP_DEFAULT_TENTHS);
    setRankText("");
    setSecret("");
    setConfirmChoice(null);
    setError(null);
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      setError(invalidUrl);
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
    if (secret.trim() !== "" && secret.length < 8) {
      setError(validation("notifications.secretTooShort"));
      return;
    }

    createOnce();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("webhook.add")}
      description={t("webhook.addDescription")}
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
      trigger={trigger}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="webhook-url">{t("webhook.endpoint")}</Label>
        <Input
          id="webhook-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://hooks.example.com/asobeast"
          aria-invalid={error === invalidUrl}
          aria-describedby={hint ? HINT_ID : undefined}
        />
        {hint && (
          <p id={HINT_ID} className="text-caption text-muted-foreground">
            {hint}
          </p>
        )}
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

      <ConfirmDropsField checked={confirmDrops} onChange={setConfirmChoice} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="webhook-secret">{t("webhook.secret")}</Label>
        <Input
          id="webhook-secret"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder={t("webhook.secretPlaceholder")}
        />
      </div>
    </AlertChannelDialog>
  );
}
