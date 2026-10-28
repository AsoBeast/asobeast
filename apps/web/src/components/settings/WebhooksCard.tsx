"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { webhookChannelOf, type WebhookItem } from "@asobeast/shared";
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
import type { ChannelEdit } from "./alert-channel/EditEventsDialog";
import { useSharedFlight, useSingleFlight } from "@/lib/single-flight";
import { WEBHOOK_CHANNEL_NAMES, webhookRowLabel } from "./webhook-channel-copy";

function WebhookRow({ webhook }: { webhook: WebhookItem }) {
  const queryClient = useQueryClient();
  const channel = webhook.channel ?? webhookChannelOf(webhook.url);
  const label = webhookRowLabel(webhook.url, channel);

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateWebhook(webhook.id, { active }),
    onSuccess: () => invalidateWebhookMutation(queryClient),
    onError: () => toast.error("Could not update webhook"),
  });

  const editEvents = useMutation({
    mutationFn: (edit: ChannelEdit) => updateWebhook(webhook.id, edit),
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

  const testOnce = useSingleFlight(test);

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
      label={label}
      channel="webhook"
      id={webhook.id}
      events={webhook.events}
      confirmDrops={webhook.confirmDrops === true}
      tag={
        <>
          {channel !== "generic" && (
            <Badge variant="outline">{WEBHOOK_CHANNEL_NAMES[channel]}</Badge>
          )}
          {webhook.hasSecret && (
            <Badge variant="secondary">
              <KeyRound />
              Signed
            </Badge>
          )}
        </>
      }
      active={webhook.active}
      activePending={toggle.isPending}
      onActiveChange={(active) => toggle.mutate(active)}
      confirmTitle="Delete this webhook?"
      confirmDescription={`AsoBeast will stop delivering alerts to ${label}. This cannot be undone.`}
      testPending={test.isPending}
      onTest={testOnce}
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
          No webhooks yet. Add one to receive metadata and rank alerts in
          Discord, Slack, Microsoft Teams, Telegram, Google Chat or your own
          endpoint.
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
