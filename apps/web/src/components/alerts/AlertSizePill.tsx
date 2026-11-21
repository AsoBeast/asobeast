import type { AlertEventItem } from "@asobeast/shared";
import { DeltaChip } from "@/components/ui/delta-chip";
import { cn } from "@/lib/utils";
import { alertEventSize } from "./alert-event-size";

export function AlertSizePill({
  payload,
  className,
}: {
  payload: AlertEventItem["payload"];
  className?: string;
}) {
  const size = alertEventSize(payload);
  if (size === null) return null;
  return (
    <DeltaChip
      value={size.value}
      polarity={size.polarity}
      period={size.period}
      digits={size.digits}
      form="pill"
      className={cn("min-w-13 justify-center", className)}
    />
  );
}
