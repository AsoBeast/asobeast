"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { flushAlerts } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { alertDeliveryKey, alertDeliveryOptions } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { PanelBody, SettingsPanel } from "./SettingsPanel";

function Field({
  label,
  inline = false,
  children,
}: {
  label: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  const id = `delivery-field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div
      role="group"
      aria-labelledby={id}
      className={inline ? "flex items-baseline gap-1" : "contents"}
    >
      <span id={id} className={inline ? undefined : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={inline ? "numeric font-medium text-foreground" : "min-w-0"}
      >
        {children}
      </span>
    </div>
  );
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function flushMessage(result: {
  flushed: number;
  channels: number;
  notifications: number;
}): string {
  if (result.flushed === 0) return "Nothing to flush";
  return `Sent ${countLabel(result.notifications, "notification")} to ${countLabel(result.channels, "channel")} from ${countLabel(result.flushed, "event")}`;
}

export function DeliveryCard() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(alertDeliveryOptions);

  const flush = useMutation({
    mutationFn: flushAlerts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: alertDeliveryKey });
      toast.success(flushMessage(result));
    },
    onError: () => toast.error("Could not flush alerts"),
  });
  const flushOnce = useSingleFlight(flush);

  return (
    <SettingsPanel
      title="Delivery"
      action={
        <Button
          variant="outline"
          size="sm"
          aria-disabled={flush.isPending || undefined}
          aria-busy={flush.isPending}
          onClick={() => flushOnce()}
        >
          {flush.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Flush now
        </Button>
      }
      footer={
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Field inline label="Last flush">
            {data.lastFlushAt ? formatDateTime(data.lastFlushAt) : "Never"}
          </Field>
          <Field inline label="Pending">
            {data.pending}
          </Field>
          <Field inline label="Claimed">
            {data.claimed}
          </Field>
        </div>
      }
    >
      <PanelBody>
        <p className="max-w-[70ch] text-body text-muted-foreground">
          {data.mode === "batched"
            ? "Daily events are sent after processing as an app update, followed by a competitor watch when each has activity."
            : "Each event is delivered instantly, one notification per event."}
        </p>
        <div className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-dense">
          <Field label="Mode">
            {data.mode === "batched" ? "Batched" : "Instant"}
          </Field>
          <Field label="Trigger">After completion</Field>
          <Field label="Pipeline starts">
            <code translate="no" className="font-mono text-caption">
              {data.pipelineCron}
            </code>
          </Field>
        </div>
      </PanelBody>
    </SettingsPanel>
  );
}
