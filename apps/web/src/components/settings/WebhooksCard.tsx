"use client";

import { useTranslations } from "next-intl";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { webhookChannelOf, type WebhookItem } from "@asobeast/shared";
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
import type { AlertSubscriptionChange } from "./alert-event-copy";
import { AlertChannelRow } from "./alert-channel/AlertChannelRow";
import { useSharedFlight, useSingleFlight } from "@/lib/single-flight";
import { webhookChannelName, webhookRowLabel } from "./webhook-channel-copy";

function WebhookRow({ webhook }: { webhook: WebhookItem }) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const channel = webhook.channel ?? webhookChannelOf(webhook.url);
  const label = webhookRowLabel(webhook.url, channel);

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateWebhook(webhook.id, { active }),
    onSuccess: () => invalidateWebhookMutation(queryClient),
    onError: () => toast.error(t("webhook.updateError")),
  });
  const toggleOnce = useSingleFlight(toggle);

  const editEvents = useMutation({
    mutationFn: (change: AlertSubscriptionChange) =>
      updateWebhook(webhook.id, change),
    onSuccess: (saved) => {
      seedWebhook(queryClient, saved);
      invalidateWebhookMutation(queryClient);
      toast.success(t("webhook.rulesSaved"));
    },
    onError: () => toast.error(t("webhook.saveRulesError")),
  });
  const saveEvents = useSharedFlight(editEvents.mutateAsync);

  const test = useMutation({
    mutationFn: () => testWebhook(webhook.id),
    onSuccess: (result) => {
      if (result.delivered) {
        toast.success(
          t("webhook.testDelivered", { status: result.status ?? "—" }),
        );
      } else {
        toast.error(
          result.status === null
            ? t("webhook.testFailedNoStatus")
            : t("webhook.testFailed", { status: result.status }),
        );
      }
    },
    onError: () => toast.error(t("webhook.testError")),
  });

  const testOnce = useSingleFlight(test);

  const remove = useMutation({
    mutationFn: () => deleteWebhook(webhook.id),
    onSuccess: () => {
      invalidateWebhookMutation(queryClient);
      toast.success(t("webhook.removed"));
    },
    onError: () => toast.error(t("webhook.removeError")),
  });
  const removeOnce = useSharedFlight(remove.mutateAsync);

  return (
    <AlertChannelRow
      label={label}
      channel="webhook"
      id={webhook.id}
      events={webhook.events}
      confirmDrops={webhook.confirmDrops === true}
      reviewScores={webhook.reviewScores}
      ratingDropTenths={webhook.ratingDropTenths}
      rankDropThreshold={webhook.rankDropThreshold}
      facts={[
        ...(channel === "generic" ? [] : [webhookChannelName(channel, t)]),
        ...(webhook.hasSecret ? [t("webhook.signed")] : []),
      ]}
      active={webhook.active}
      activePending={toggle.isPending}
      onActiveChange={toggleOnce}
      confirmTitle={t("webhook.deleteTitle")}
      confirmDescription={t("webhook.deleteDescription", { label })}
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
  const t = useTranslations("notifications");
  const { data } = useSuspenseQuery(webhooksOptions);

  return (
    <AlertChannelCard title={t("webhook.title")} action={<AddWebhookDialog />}>
      {data.length === 0 ? (
        <AlertChannelEmpty>{t("webhook.empty")}</AlertChannelEmpty>
      ) : (
        <AlertChannelList label={t("webhook.listLabel")}>
          {data.map((webhook) => (
            <WebhookRow key={webhook.id} webhook={webhook} />
          ))}
        </AlertChannelList>
      )}
    </AlertChannelCard>
  );
}
