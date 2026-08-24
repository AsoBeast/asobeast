"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { flushAlerts } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { alertDeliveryKey, alertDeliveryOptions } from "@/lib/queries";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = `delivery-field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <span id={id} className="text-xs text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{children}</span>
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

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Alerts</CardDescription>
          <CardTitle>Delivery</CardTitle>
        </div>
        <Button
          size="sm"
          disabled={flush.isPending}
          aria-busy={flush.isPending}
          onClick={() => flush.mutate()}
        >
          {flush.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Flush now
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {data.mode === "batched"
            ? "Daily events are sent after processing as an app update, followed by a competitor watch when each has activity."
            : "Each event is delivered instantly, one notification per event."}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Field label="Mode">
            <Badge variant={data.mode === "batched" ? "default" : "outline"}>
              {data.mode === "batched" ? "Batched" : "Instant"}
            </Badge>
          </Field>
          <Field label="Trigger">
            <Badge variant="outline">After completion</Badge>
          </Field>
          <Field label="Pipeline starts">
            <code className="font-mono text-xs">{data.pipelineCron}</code>
          </Field>
          <Field label="Last flush">
            {data.lastFlushAt ? formatDateTime(data.lastFlushAt) : "Never"}
          </Field>
          <Field label="Pending">{data.pending}</Field>
          <Field label="Claimed">{data.claimed}</Field>
        </div>
      </CardContent>
    </Card>
  );
}
