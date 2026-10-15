"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import type { WebhookEvent, WebhookItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { deleteWebhook, testWebhook, updateWebhook } from "@/lib/api";
import {
  invalidateWebhookMutation,
  seedWebhook,
  webhooksOptions,
} from "@/lib/queries";
import {
  AlertChannelCard,
  AlertChannelEmpty,
  AlertChannelList,
} from "./alert-channel/AlertChannelCard";
import { AddWebhookDialog } from "./AddWebhookDialog";
import { AlertChannelRow } from "./alert-channel/AlertChannelRow";
import { useSharedFlight } from "@/lib/single-flight";

function WebhookRow({ webhook }: { webhook: WebhookItem }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateWebhook(webhook.id, { active }),
    onSuccess: () => invalidateWebhookMutation(queryClient),
    onError: () => toast.error("Could not update webhook"),
  });

  const editEvents = useMutation({
    mutationFn: (events: WebhookEvent[]) =>
      updateWebhook(webhook.id, { events }),
    onSuccess: (saved) => {
      seedWebhook(queryClient, saved);
      invalidateWebhookMutation(queryClient);
      toast.success("Webhook events saved");
    },
    onError: () => toast.error("Could not save the webhook events"),
  });
  const saveEvents = useSharedFlight(editEvents.mutateAsync);

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
  const removeOnce = useSharedFlight(remove.mutateAsync);

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
      confirmDescription={`AsoBeast will stop delivering alerts to ${webhook.url}. This cannot be undone.`}
      testPending={test.isPending}
      onTest={() => test.mutate()}
      deletePending={remove.isPending}
      onDelete={removeOnce}
      eventsPending={editEvents.isPending}
      onEventsSave={saveEvents}
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
