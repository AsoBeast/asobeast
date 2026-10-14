"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { AddEmailAlertDialog } from "@/components/settings/AddEmailAlertDialog";
import { AddWebhookDialog } from "@/components/settings/AddWebhookDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  alertsConfigOptions,
  emailAlertsOptions,
  firstRunOptions,
  webhooksOptions,
} from "@/lib/queries";
import {
  ALERTS_NUDGE_CHANGE_EVENT,
  alertsNudgeState,
  readDismissed,
  writeDismissed,
} from "./alerts-nudge";

const EMAIL_DELIVERY_GUIDE =
  "https://docs.asobeast.com/guides/alerts#email-delivery";

const dismissedInMemory = new Set<string>();
const localStorage = () => window.localStorage;

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(ALERTS_NUDGE_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(ALERTS_NUDGE_CHANGE_EVENT, listener);
  };
}

function useNudgeDismissal(appId: string) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => dismissedInMemory.has(appId) || readDismissed(localStorage, appId),
    () => true,
  );
  const dismiss = () => {
    if (!writeDismissed(localStorage, appId)) dismissedInMemory.add(appId);
    window.dispatchEvent(new Event(ALERTS_NUDGE_CHANGE_EVENT));
  };
  return [dismissed, dismiss] as const;
}

export function AlertsNudge({ id }: { id: string }) {
  const firstRun = useQuery(firstRunOptions(id));
  const webhooks = useQuery(webhooksOptions);
  const emailAlerts = useQuery(emailAlertsOptions);
  const config = useQuery(alertsConfigOptions);
  const [dismissed, dismiss] = useNudgeDismissal(id);
  const state = alertsNudgeState({
    firstRun: firstRun.data,
    channels:
      webhooks.data && emailAlerts.data
        ? webhooks.data.length + emailAlerts.data.length
        : undefined,
    emailEnabled: config.data?.emailEnabled,
    dismissed,
  });

  if (state === "hidden") return null;

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing aria-hidden className="size-4 text-muted-foreground" />
          Get told when a position moves
        </CardTitle>
        <CardDescription>
          Two daily captures are in, so positions can now move. Email or a
          webhook tells you when one drops, climbs or enters the top ten.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {state === "email" ? (
            <AddEmailAlertDialog
              trigger={<Button>Add an email alert</Button>}
            />
          ) : (
            <AddWebhookDialog trigger={<Button>Add a webhook</Button>} />
          )}
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
        {state === "webhook" ? (
          <p className="text-caption text-muted-foreground">
            Email alerts need SMTP on this instance.{" "}
            <a
              href={EMAIL_DELIVERY_GUIDE}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline decoration-primary underline-offset-4"
            >
              Set up email delivery
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
