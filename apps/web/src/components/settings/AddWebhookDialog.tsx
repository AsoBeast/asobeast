"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { REVIEW_SCORES } from "@asobeast/shared";
import type { WebhookEvent } from "@asobeast/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createWebhook } from "@/lib/api";
import { invalidateWebhookMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { needsAStar, reviewScoresToSend } from "./alert-event-copy";
import { AlertSubscriptionFields } from "./alert-events";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";
import { channelHint } from "./webhook-channel-copy";

const HINT_ID = "webhook-channel-hint";

export function AddWebhookDialog({ trigger }: { trigger?: ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["metadata.changed"]);
  const [stars, setStars] = useState<number[]>([...REVIEW_SCORES]);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createWebhook({
        url,
        events,
        reviewScores: reviewScoresToSend(events, stars),
        secret: secret.trim() === "" ? undefined : secret,
      }),
    onSuccess: () => {
      invalidateWebhookMutation(queryClient);
      toast.success("Webhook added");
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not add webhook",
      );
    },
  });
  const createOnce = useSingleFlight(mutation);
  const hint = channelHint(url);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setUrl("");
    setEvents(["metadata.changed"]);
    setStars([...REVIEW_SCORES]);
    setSecret("");
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
      setError("Enter a valid http(s) URL");
      return;
    }
    if (events.length === 0) {
      setError("Select at least one event");
      return;
    }
    if (needsAStar(events, stars)) {
      setError("Pick at least one star");
      return;
    }
    if (secret.trim() !== "" && secret.length < 8) {
      setError("Secret must be at least 8 characters");
      return;
    }

    createOnce();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Add webhook"
      description="AsoBeast POSTs a JSON payload to this URL when a subscribed event fires. Add a secret to receive an HMAC signature header."
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
      trigger={trigger}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="webhook-url">Endpoint URL</Label>
        <Input
          id="webhook-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://hooks.example.com/asobeast"
          aria-invalid={error !== null}
          aria-describedby={hint ? HINT_ID : undefined}
        />
        {hint && (
          <p id={HINT_ID} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>

      <AlertSubscriptionFields
        events={events}
        stars={stars}
        onEventsChange={setEvents}
        onStarsChange={setStars}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="webhook-secret">Secret (optional)</Label>
        <Input
          id="webhook-secret"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
    </AlertChannelDialog>
  );
}
