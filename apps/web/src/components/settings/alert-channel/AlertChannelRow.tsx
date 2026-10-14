"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Clock, Loader2, MailCheck, MailX, Send, Trash2 } from "lucide-react";
import type { WebhookEvent } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EVENT_LABELS } from "../alert-events";
import { DeliveriesSection } from "../DeliveriesSection";
import { EditEventsDialog } from "./EditEventsDialog";

export interface AwaitingConfirmation {
  pending: boolean;
  onResend: () => void;
  unsubscribed: boolean;
}

function RowAction({
  awaiting,
  testPending,
  onTest,
}: {
  awaiting?: AwaitingConfirmation;
  testPending: boolean;
  onTest: () => void;
}) {
  if (awaiting?.unsubscribed) return null;
  if (awaiting) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={awaiting.pending}
        onClick={awaiting.onResend}
      >
        {awaiting.pending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <MailCheck />
        )}
        Resend confirmation
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" disabled={testPending} onClick={onTest}>
      {testPending ? <Loader2 className="animate-spin" /> : <Send />}
      Send test
    </Button>
  );
}

function ConfirmationNotice({ awaiting }: { awaiting?: AwaitingConfirmation }) {
  if (!awaiting) return null;
  const [Icon, title, detail] = awaiting.unsubscribed
    ? [
        MailX,
        "Unsubscribed.",
        "The recipient asked not to receive these alerts, so they are not asked to confirm again.",
      ]
    : [
        Clock,
        "Awaiting confirmation.",
        "No alerts are sent until the recipient follows the link in the email.",
      ];
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-medium text-foreground">{title}</strong>{" "}
        {detail}
      </span>
    </p>
  );
}

export function AlertChannelRow({
  label,
  channel,
  id,
  events,
  tag,
  awaiting,
  active,
  activePending,
  onActiveChange,
  confirmTitle,
  confirmDescription,
  testPending,
  onTest,
  deletePending,
  onDelete,
  eventsPending,
  onEventsSave,
}: {
  label: string;
  channel: "webhook" | "email";
  id: string;
  events: WebhookEvent[];
  tag?: ReactNode;
  awaiting?: AwaitingConfirmation;
  active: boolean;
  activePending: boolean;
  onActiveChange: (active: boolean) => void;
  confirmTitle: string;
  confirmDescription: ReactNode;
  testPending: boolean;
  onTest: () => void;
  deletePending: boolean;
  onDelete: () => Promise<unknown>;
  eventsPending: boolean;
  onEventsSave: (events: WebhookEvent[]) => Promise<unknown>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 flex-1 basis-48 font-medium break-all">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <Switch
            checked={active}
            disabled={activePending}
            aria-label={`Toggle ${label}`}
            onCheckedChange={onActiveChange}
          />
          <RowAction
            awaiting={awaiting}
            testPending={testPending}
            onTest={onTest}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${label}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <ConfirmationNotice awaiting={awaiting} />

      <div className="flex flex-wrap items-center gap-1">
        {tag}
        {events.map((event) => (
          <Badge key={event} variant="outline">
            {EVENT_LABELS[event]}
          </Badge>
        ))}
        <EditEventsDialog
          label={label}
          events={events}
          pending={eventsPending}
          onSave={onEventsSave}
        />
      </div>

      <DeliveriesSection channel={channel} id={id} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={(event) => {
                event.preventDefault();
                void onDelete().then(
                  () => setConfirmOpen(false),
                  () => undefined,
                );
              }}
            >
              {deletePending ? "Removing…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
