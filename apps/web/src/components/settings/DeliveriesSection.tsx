"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
} from "lucide-react";
import type { AlertDeliveryItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDeliveries } from "@/lib/api";
import { deliveryKeys } from "@/lib/queries";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { EVENT_LABELS } from "./alert-events";

function StatusBadge({ status }: { status: AlertDeliveryItem["status"] }) {
  if (status === "success") {
    return (
      <Badge variant="secondary">
        <CheckCircle2 className="text-success" />
        Success
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <XCircle className="text-destructive" />
      Failed
    </Badge>
  );
}

function DeliveryRow({ delivery }: { delivery: AlertDeliveryItem }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <StatusBadge status={delivery.status} />
      <span className="text-muted-foreground">
        {EVENT_LABELS[delivery.event]}
      </span>
      <span className="text-muted-foreground">attempt {delivery.attempt}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            className="ml-auto text-muted-foreground"
            dateTime={delivery.createdAt}
          >
            {formatRelativeTime(delivery.createdAt)}
          </time>
        </TooltipTrigger>
        <TooltipContent>
          {delivery.detail ?? formatDateTime(delivery.createdAt)}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

export function DeliveriesSection({
  channel,
  id,
}: {
  channel: "webhook" | "email";
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: deliveryKeys.list(channel, id),
    queryFn: () =>
      getDeliveries(
        channel === "webhook" ? { webhookId: id } : { emailAlertId: id },
      ),
    enabled: open,
  });

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Recent deliveries
      </button>

      {open ? (
        <div className="mt-2 pl-4">
          {isLoading ? (
            <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </p>
          ) : data && data.length > 0 ? (
            <ul className="divide-y">
              {data.map((delivery) => (
                <DeliveryRow key={delivery.id} delivery={delivery} />
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              No deliveries yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
