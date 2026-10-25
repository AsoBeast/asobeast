"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { EmailAlertItem, WebhookEvent } from "@asobeast/shared";
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
import { AlertChannelRow } from "./alert-channel/AlertChannelRow";
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
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateEmailAlert(alert.id, { active }),
    onSuccess: () => invalidateEmailAlertMutation(queryClient),
    onError: () => toast.error("Could not update email alert"),
  });

  const editEvents = useMutation({
    mutationFn: (events: WebhookEvent[]) =>
      updateEmailAlert(alert.id, { events }),
    onSuccess: (saved) => {
      seedEmailAlert(queryClient, saved);
      invalidateEmailAlertMutation(queryClient);
      toast.success("Email alert events saved");
    },
    onError: () => toast.error("Could not save the email alert events"),
  });
  const saveEvents = useSharedFlight(editEvents.mutateAsync);

  const test = useMutation({
    mutationFn: () => testEmailAlert(alert.id),
    onSuccess: (result) => {
      if (result.delivered) {
        toast.success("Test email sent");
      } else {
        toast.error("Could not send the test email");
      }
    },
    onError: () => toast.error("Could not send the test email"),
  });

  const resend = useMutation({
    mutationFn: () => resendEmailAlertConfirmation(alert.id),
    onSuccess: () =>
      toast.success(
        `Confirmation email sent to ${alert.email}`,
        recipientToast(alert),
      ),
    onSettled: () => invalidateEmailAlertMutation(queryClient),
    onError: (err) =>
      toast.error(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not send the confirmation email",
        recipientToast(alert),
      ),
  });

  const testOnce = useSingleFlight(test);
  const resendOnce = useSingleFlight(resend);

  const remove = useMutation({
    mutationFn: () => deleteEmailAlert(alert.id),
    onSuccess: () => {
      invalidateEmailAlertMutation(queryClient);
      toast.success("Email alert removed");
    },
    onError: () => toast.error("Could not remove email alert"),
  });
  const removeOnce = useSharedFlight(remove.mutateAsync);

  return (
    <AlertChannelRow
      label={alert.email}
      channel="email"
      id={alert.id}
      events={alert.events}
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
      onActiveChange={(active) => toggle.mutate(active)}
      confirmTitle="Delete this email alert?"
      confirmDescription={`AsoBeast will stop emailing ${alert.email}. This cannot be undone.`}
      testPending={test.isPending}
      onTest={testOnce}
      deletePending={remove.isPending}
      onDelete={removeOnce}
      eventsPending={editEvents.isPending}
      onEventsSave={saveEvents}
    />
  );
}

function SetupHint() {
  return (
    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Email alerts are disabled.</p>
      <p className="mt-1">
        Set the SMTP environment variables on the API to enable them:
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SMTP_VARS.map((name) => (
          <code
            key={name}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
          >
            {name}
          </code>
        ))}
      </div>
      <p className="mt-3">
        <code className="font-mono text-xs">SMTP_HOST</code> and{" "}
        <code className="font-mono text-xs">SMTP_FROM</code> are required.
      </p>
    </div>
  );
}

export function EmailAlertsCard() {
  const { data: config } = useSuspenseQuery(alertsConfigOptions);
  const { data } = useSuspenseQuery(emailAlertsOptions);

  return (
    <AlertChannelCard
      title="Email"
      action={config.emailEnabled ? <AddEmailAlertDialog /> : null}
    >
      {!config.emailEnabled ? (
        <SetupHint />
      ) : data.length === 0 ? (
        <AlertChannelEmpty>
          No email alerts yet. Add a recipient to receive metadata and rank
          alerts by email.
        </AlertChannelEmpty>
      ) : (
        <AlertChannelList label="Configured email alerts and their subscribed events.">
          {data.map((alert) => (
            <EmailAlertRow key={alert.id} alert={alert} />
          ))}
        </AlertChannelList>
      )}
    </AlertChannelCard>
  );
}
