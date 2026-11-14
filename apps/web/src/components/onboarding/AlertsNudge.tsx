"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AddEmailAlertDialog } from "@/components/settings/AddEmailAlertDialog";
import { AddWebhookDialog } from "@/components/settings/AddWebhookDialog";
import { Button } from "@/components/ui/button";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  alertsConfigOptions,
  emailAlertsOptions,
  firstRunOptions,
  webhooksOptions,
} from "@/lib/queries";
import {
  ALERTS_NUDGE_CHANGE_EVENT,
  alertsNudgeState,
  nudgeDue,
  readDismissed,
  writeDismissed,
} from "./alerts-nudge";

const EMAIL_DELIVERY_GUIDE =
  "https://docs.asobeast.com/guides/alerts#email-delivery";

const dismissedInMemory = new Set<string>();
const storage = () => window.localStorage;

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
    () => dismissedInMemory.has(appId) || readDismissed(storage, appId),
    () => true,
  );
  const dismiss = () => {
    if (!writeDismissed(storage, appId)) dismissedInMemory.add(appId);
    window.dispatchEvent(new Event(ALERTS_NUDGE_CHANGE_EVENT));
  };
  return [dismissed, dismiss] as const;
}

export function AlertsNudge({ id }: { id: string }) {
  const firstRun = useQuery(firstRunOptions(id));
  const [dismissed, dismiss] = useNudgeDismissal(id);
  const enabled = !dismissed && nudgeDue(firstRun.data);
  const webhooks = useQuery({ ...webhooksOptions, enabled });
  const emailAlerts = useQuery({ ...emailAlertsOptions, enabled });
  const config = useQuery({ ...alertsConfigOptions, enabled });
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
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Get told when a position moves</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="max-w-[70ch] text-dense text-muted-foreground">
          Two daily captures are in, so positions can now move. Email or a
          webhook tells you when one drops, climbs or enters the top ten.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {state === "email" ? (
            <AddEmailAlertDialog
              trigger={<Button variant="outline">Add an email alert</Button>}
            />
          ) : (
            <AddWebhookDialog
              trigger={<Button variant="outline">Add a webhook</Button>}
            />
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
              className="text-foreground link-underline"
            >
              Set up email delivery
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
