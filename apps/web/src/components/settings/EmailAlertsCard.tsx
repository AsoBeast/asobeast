"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { EmailAlertItem, WebhookEvent } from "@asobeast/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  createEmailAlert,
  deleteEmailAlert,
  testEmailAlert,
  updateEmailAlert,
} from "@/lib/api";
import {
  alertsConfigOptions,
  emailAlertsOptions,
  invalidateEmailAlertMutation,
} from "@/lib/queries";
import { EventSelection } from "./alert-events";
import {
  AlertChannelCard,
  AlertChannelEmpty,
  AlertChannelList,
} from "./alert-channel/AlertChannelCard";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";
import { AlertChannelRow } from "./alert-channel/AlertChannelRow";

const SMTP_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
];

function AddEmailAlertDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["metadata.changed"]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createEmailAlert({ email, events }),
    onSuccess: () => {
      invalidateEmailAlertMutation(queryClient);
      toast.success("Email alert added");
      setOpen(false);
      setEmail("");
      setEvents(["metadata.changed"]);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not add email alert",
      );
    },
  });

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (events.length === 0) {
      setError("Select at least one event");
      return;
    }

    mutation.mutate();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={setOpen}
      label="Add email alert"
      description="asobeast emails this recipient when a subscribed event fires, using your configured SMTP server."
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email-alert-address">Recipient email</Label>
        <Input
          id="email-alert-address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="alerts@example.com"
          aria-invalid={error !== null}
        />
      </div>

      <EventSelection value={events} onChange={setEvents} />
    </AlertChannelDialog>
  );
}

function EmailAlertRow({ alert }: { alert: EmailAlertItem }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (active: boolean) => updateEmailAlert(alert.id, { active }),
    onSuccess: () => invalidateEmailAlertMutation(queryClient),
    onError: () => toast.error("Could not update email alert"),
  });

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

  const remove = useMutation({
    mutationFn: () => deleteEmailAlert(alert.id),
    onSuccess: () => {
      invalidateEmailAlertMutation(queryClient);
      toast.success("Email alert removed");
    },
    onError: () => toast.error("Could not remove email alert"),
  });

  return (
    <AlertChannelRow
      label={alert.email}
      channel="email"
      id={alert.id}
      events={alert.events}
      active={alert.active}
      activePending={toggle.isPending}
      onActiveChange={(active) => toggle.mutate(active)}
      confirmTitle="Delete this email alert?"
      confirmDescription={`asobeast will stop emailing ${alert.email}. This cannot be undone.`}
      testPending={test.isPending}
      onTest={() => test.mutate()}
      deletePending={remove.isPending}
      onDelete={() => remove.mutateAsync()}
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
