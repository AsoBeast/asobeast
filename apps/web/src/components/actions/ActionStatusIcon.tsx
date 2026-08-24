import { Ban, Check, Clock, CircleCheck, CircleDashed } from "lucide-react";
import type { ActionStatus } from "@asobeast/shared";

const STATUS_ICON: Record<ActionStatus, typeof Check> = {
  OPEN: CircleDashed,
  SNOOZED: Clock,
  DONE: Check,
  DISMISSED: Ban,
  RESOLVED: CircleCheck,
};

export function StatusIcon({ status }: { status: ActionStatus }) {
  const Icon = STATUS_ICON[status];
  return <Icon aria-hidden className="size-3.5" />;
}
