"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WebhookEvent } from "@asobeast/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createWebhook } from "@/lib/api";
import { invalidateWebhookMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { EventSelection } from "./alert-events";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";

export function AddWebhookDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["metadata.changed"]);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createWebhook({
        url,
        events,
        secret: secret.trim() === "" ? undefined : secret,
      }),
    onSuccess: () => {
      invalidateWebhookMutation(queryClient);
      toast.success("Webhook added");
      setOpen(false);
      setUrl("");
      setEvents(["metadata.changed"]);
      setSecret("");
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
    if (secret.trim() !== "" && secret.length < 8) {
      setError("Secret must be at least 8 characters");
      return;
    }

    createOnce();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={setOpen}
      label="Add webhook"
      description="AsoBeast POSTs a JSON payload to this URL when a subscribed event fires. Add a secret to receive an HMAC signature header."
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="webhook-url">Endpoint URL</Label>
        <Input
          id="webhook-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://hooks.example.com/asobeast"
          aria-invalid={error !== null}
        />
      </div>

      <EventSelection value={events} onChange={setEvents} />

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
