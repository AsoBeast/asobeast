"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
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

export function AlertChannelRow({
  label,
  channel,
  id,
  events,
  tag,
  active,
  activePending,
  onActiveChange,
  confirmTitle,
  confirmDescription,
  testPending,
  onTest,
  deletePending,
  onDelete,
}: {
  label: string;
  channel: "webhook" | "email";
  id: string;
  events: WebhookEvent[];
  tag?: ReactNode;
  active: boolean;
  activePending: boolean;
  onActiveChange: (active: boolean) => void;
  confirmTitle: string;
  confirmDescription: ReactNode;
  testPending: boolean;
  onTest: () => void;
  deletePending: boolean;
  onDelete: () => Promise<unknown>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate font-medium" title={label}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          <Switch
            checked={active}
            disabled={activePending}
            aria-label={`Toggle ${label}`}
            onCheckedChange={onActiveChange}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={testPending}
            onClick={onTest}
          >
            {testPending ? <Loader2 className="animate-spin" /> : <Send />}
            Send test
          </Button>
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

      <div className="flex flex-wrap items-center gap-1">
        {tag}
        {events.map((event) => (
          <Badge key={event} variant="outline">
            {EVENT_LABELS[event]}
          </Badge>
        ))}
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
