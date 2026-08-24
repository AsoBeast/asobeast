import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownCircle,
  CircleDot,
} from "lucide-react";
import type { ActionPriority } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { ACTION_PRIORITY_LABEL } from "./action-copy";

const PRIORITY_ICON = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: CircleDot,
  low: ArrowDownCircle,
} as const;

const PRIORITY_CLASS: Record<ActionPriority, string> = {
  critical:
    "border-priority-critical/40 bg-priority-critical/10 text-priority-critical",
  high: "border-priority-high/40 bg-priority-high/10 text-priority-high",
  medium:
    "border-priority-medium/40 bg-priority-medium/10 text-priority-medium",
  low: "border-priority-low/40 bg-priority-low/10 text-priority-low",
};

export function ActionPriorityBadge({
  priority,
}: {
  priority: ActionPriority;
}) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <Badge variant="outline" className={PRIORITY_CLASS[priority]}>
      <Icon aria-hidden className="size-3.5" />
      {ACTION_PRIORITY_LABEL[priority]}
    </Badge>
  );
}
