"use client";

import { useTranslations } from "next-intl";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { EmailAlertItem, EssentialAlertsNeed } from "@asobeast/shared";
import {
  ApiError,
  deleteEmailAlert,
  resendEmailAlertConfirmation,
  testEmailAlert,
  updateEmailAlert,
} from "@/lib/api";
import {
  alertsConfigOptions,
  emailAlertsOptions,
  invalidateEmailAlertMutation,
  seedEmailAlert,
} from "@/lib/queries";
import { awaitsConfirmation, recipientToast } from "./email-alert-recipient";
import {
  AlertChannelCard,
  AlertChannelEmpty,
  AlertChannelList,
} from "./alert-channel/AlertChannelCard";
import { AddEmailAlertDialog } from "./AddEmailAlertDialog";
import type { AlertSubscriptionChange } from "./alert-event-copy";
import { AlertChannelRow } from "./alert-channel/AlertChannelRow";
import { essentialNeed as essentialNeedDescriptor } from "./essential-alerts-copy";
import { EssentialAlertsNotice } from "./essential-alerts-notice";
import { PanelBody } from "./SettingsPanel";
import { useSharedFlight, useSingleFlight } from "@/lib/single-flight";

const SMTP_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
];

function EmailAlertRow({ alert }: { alert: EmailAlertItem }) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateEmailAlert(alert.id, { active }),
    onSuccess: () => invalidateEmailAlertMutation(queryClient),
    onError: () => toast.error(t("email.updateError")),
  });
  const toggleOnce = useSingleFlight(toggle);

  const editEvents = useMutation({
    mutationFn: (change: AlertSubscriptionChange) =>
      updateEmailAlert(alert.id, change),
    onSuccess: (saved) => {
      seedEmailAlert(queryClient, saved);
      invalidateEmailAlertMutation(queryClient);
      toast.success(t("email.rulesSaved"));
    },
    onError: () => toast.error(t("email.saveRulesError")),
  });
  const saveEvents = useSharedFlight(editEvents.mutateAsync);

  const test = useMutation({
    mutationFn: () => testEmailAlert(alert.id),
    onSuccess: (result) => {
      if (result.delivered) {
        toast.success(t("email.testSent"));
      } else {
        toast.error(t("email.testFailed"));
      }
    },
    onError: () => toast.error(t("email.testFailed")),
  });

  const resend = useMutation({
    mutationFn: () => resendEmailAlertConfirmation(alert.id),
    onSuccess: () =>
      toast.success(
        t("email.confirmationSent", { email: alert.email }),
        recipientToast(alert),
      ),
    onSettled: () => invalidateEmailAlertMutation(queryClient),
    onError: (err) =>
      toast.error(
        err instanceof ApiError ? err.envelope.message : t("email.resendError"),
        recipientToast(alert),
      ),
  });

  const testOnce = useSingleFlight(test);
  const resendOnce = useSingleFlight(resend);

  const remove = useMutation({
    mutationFn: () => deleteEmailAlert(alert.id),
    onSuccess: () => {
      invalidateEmailAlertMutation(queryClient);
      toast.success(t("email.removed"));
    },
    onError: () => toast.error(t("email.removeError")),
  });
  const removeOnce = useSharedFlight(remove.mutateAsync);

  return (
    <AlertChannelRow
      label={alert.email}
      channel="email"
      id={alert.id}
      events={alert.events}
      confirmDrops={alert.confirmDrops === true}
      reviewScores={alert.reviewScores}
      ratingDropTenths={alert.ratingDropTenths}
      rankDropThreshold={alert.rankDropThreshold}
      essential={alert.essential === true}
      awaiting={
        awaitsConfirmation(alert)
          ? {
              pending: resend.isPending,
              onResend: resendOnce,
              unsubscribed: alert.unsubscribed === true,
            }
          : undefined
      }
      active={alert.active}
      activePending={toggle.isPending}
      onActiveChange={toggleOnce}
      confirmTitle={t("email.deleteTitle")}
      confirmDescription={t("email.deleteDescription", { email: alert.email })}
      testPending={test.isPending}
      onTest={testOnce}
      deletePending={remove.isPending}
      onDelete={removeOnce}
      eventsPending={editEvents.isPending}
      onEventsSave={saveEvents}
    />
  );
}

function SetupHint({ need }: { need: EssentialAlertsNeed | null | undefined }) {
  const t = useTranslations("notifications");
  return (
    <PanelBody className="text-body text-muted-foreground">
      <p className="font-medium text-foreground">{t("email.disabled")}</p>
      <p>{t("email.setupIntro")}</p>
      <p translate="no" className="font-mono text-caption text-foreground">
        {SMTP_VARS.join(" ")}
      </p>
      <p>
        {t.rich("email.required", {
          host: (chunks) => (
            <code className="font-mono text-caption">{chunks}</code>
          ),
          from: (chunks) => (
            <code className="font-mono text-caption">{chunks}</code>
          ),
        })}
      </p>
      <EssentialAlertsNotice need={need} />
    </PanelBody>
  );
}

export function EmailAlertsCard() {
  const t = useTranslations("notifications");
  const { data: config } = useSuspenseQuery(alertsConfigOptions);
  const { data } = useSuspenseQuery(emailAlertsOptions);
  const essentialNeed =
    config.essentialAlertsPending === false
      ? undefined
      : config.essentialAlertsNeed;

  return (
    <AlertChannelCard
      title={t("email.title")}
      action={config.emailEnabled ? <AddEmailAlertDialog /> : null}
    >
      {config.emailEnabled && essentialNeedDescriptor(essentialNeed) ? (
        <PanelBody className="border-b border-border-subtle">
          <EssentialAlertsNotice need={essentialNeed} />
        </PanelBody>
      ) : null}
      {!config.emailEnabled ? (
        <SetupHint need={essentialNeed} />
      ) : data.length === 0 ? (
        <AlertChannelEmpty>
          {essentialNeed === null ? t("essential.empty") : t("email.empty")}
        </AlertChannelEmpty>
      ) : (
        <AlertChannelList label={t("email.listLabel")}>
          {data.map((alert) => (
            <EmailAlertRow key={alert.id} alert={alert} />
          ))}
        </AlertChannelList>
      )}
    </AlertChannelCard>
  );
}
