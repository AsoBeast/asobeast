"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import type { WebhookEvent, WebhookItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  createWebhook,
  deleteWebhook,
  testWebhook,
  updateWebhook,
} from "@/lib/api";
import { invalidateWebhookMutation, webhooksOptions } from "@/lib/queries";
import { EventToggles } from "./alert-events";
import {
  AlertChannelCard,
  AlertChannelEmpty,
  AlertChannelList,
} from "./alert-channel/AlertChannelCard";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";
import { AlertChannelRow } from "./alert-channel/AlertChannelRow";

function AddWebhookDialog() {
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

    mutation.mutate();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={setOpen}
      label="Add webhook"
      description="asobeast POSTs a JSON payload to this URL when a subscribed event fires. Add a secret to receive an HMAC signature header."
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

      <div className="flex flex-col gap-2">
        <Label>Events</Label>
        <EventToggles value={events} onChange={setEvents} />
      </div>

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

function WebhookRow({ webhook }: { webhook: WebhookItem }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateWebhook(webhook.id, { active }),
    onSuccess: () => invalidateWebhookMutation(queryClient),
    onError: () => toast.error("Could not update webhook"),
  });

  const test = useMutation({
    mutationFn: () => testWebhook(webhook.id),
    onSuccess: (result) => {
      if (result.delivered) {
        toast.success(`Delivered (status ${result.status ?? "—"})`);
      } else {
        toast.error(
          `Not delivered${result.status !== null ? ` (status ${result.status})` : ""}`,
        );
      }
    },
    onError: () => toast.error("Could not reach the webhook"),
  });

  const remove = useMutation({
    mutationFn: () => deleteWebhook(webhook.id),
    onSuccess: () => {
      invalidateWebhookMutation(queryClient);
      toast.success("Webhook removed");
    },
    onError: () => toast.error("Could not remove webhook"),
  });

  return (
    <AlertChannelRow
      label={webhook.url}
      channel="webhook"
      id={webhook.id}
      events={webhook.events}
      tag={
        webhook.hasSecret ? (
          <Badge variant="secondary">
            <KeyRound />
            Signed
          </Badge>
        ) : null
      }
      active={webhook.active}
      activePending={toggle.isPending}
      onActiveChange={(active) => toggle.mutate(active)}
      confirmTitle="Delete this webhook?"
      confirmDescription={`asobeast will stop delivering alerts to ${webhook.url}. This cannot be undone.`}
      testPending={test.isPending}
      onTest={() => test.mutate()}
      deletePending={remove.isPending}
      onDelete={() => remove.mutateAsync()}
    />
  );
}

export function WebhooksCard() {
  const { data } = useSuspenseQuery(webhooksOptions);

  return (
    <AlertChannelCard title="Webhooks" action={<AddWebhookDialog />}>
      {data.length === 0 ? (
        <AlertChannelEmpty>
          No webhooks yet. Add one to receive metadata and rank alerts in Slack,
          Discord, ntfy or your own endpoint.
        </AlertChannelEmpty>
      ) : (
        <AlertChannelList label="Configured alert webhooks and their subscribed events.">
          {data.map((webhook) => (
            <WebhookRow key={webhook.id} webhook={webhook} />
          ))}
        </AlertChannelList>
      )}
    </AlertChannelCard>
  );
}
