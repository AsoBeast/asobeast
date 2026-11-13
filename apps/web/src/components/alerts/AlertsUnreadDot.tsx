"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/use-auth";
import { useAlertsSeen } from "@/components/layout/AlertsSeen";
import { hasUnread } from "@/lib/alerts-seen";
import { alertNewestOptions } from "@/lib/queries";

export function AlertsUnreadDot() {
  const { status } = useAuth();
  const { seenAt } = useAlertsSeen();
  const { data } = useQuery({
    ...alertNewestOptions,
    enabled: Boolean(status?.authenticated),
  });
  if (!hasUnread(data?.events[0]?.occurredAt, seenAt)) return null;

  return (
    <>
      <span className="sr-only">, new alerts</span>
      <span
        data-slot="alerts-unread"
        aria-hidden
        className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-mark ring-2 ring-sidebar"
      />
    </>
  );
}
